import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormArray, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs';
import { CaminhaoResponse, MotoristaResponse, ViagemHistoricaRequest, ViagemResponse } from '../../../core/modelos/api.modelos';
import { ViagensService } from '../../../core/api/viagens.service';
import { SessaoService } from '../../../core/sessao/sessao.service';
import { normalizarFalha } from '../../../core/http/falha-api';
import { AvisoService } from '../../../compartilhado/aviso.service';
import { hojeEmBrasilia } from '../../../compartilhado/formatacao';
import { FORMATO, decimalPositivoValidator, inteiroValidator, paraDecimalApi } from '../../../compartilhado/validadores';
import {
  GrupoAbastecimento, GrupoDespesa, GrupoPedagio, grupoAbastecimento, grupoDespesa, grupoPedagio, paraAbastecimentoRequest,
  paraDespesaRequest, paraPedagioRequest
} from '../lancamento/lancamento-campos';
import { OpcaoResponsavel } from '../viagem-regras';

export interface DadosHistorica {
  /** Caminhões não excluídos do DONO; o servidor confere inativação/exclusão pelas datas. */
  caminhoes: CaminhaoResponse[];
  motoristas: MotoristaResponse[];
}

const NINGUEM = '';
/** Limite de itens por lista no contrato. */
export const LIMITE_ITENS_HISTORICA = 200;

/** Consumo vazio é exigido quando houve deslocamento vazio. */
function consumoVazioSeHouveVazio(grupo: AbstractControl): ValidationErrors | null {
  const kmVazio = grupo.get('kmInicialVazio')?.value;
  const consumo = grupo.get('consumoMedioVazio')?.value;
  return kmVazio !== '' && kmVazio !== null && !consumo ? { consumoVazioObrigatorio: true } : null;
}

/**
 * Viagem histórica (frete esquecido), só DONO: nasce finalizada numa única operação,
 * com listas opcionais de abastecimentos, pedágios e despesas. Se um item for inválido,
 * o servidor não grava nada.
 */
@Component({
  selector: 'app-historica-viagem',
  standalone: false,
  templateUrl: './historica-viagem.component.html'
})
export class HistoricaViagemComponent {
  private readonly dados = inject<DadosHistorica>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<HistoricaViagemComponent, ViagemResponse>>(MatDialogRef);
  private readonly servico = inject(ViagensService);
  private readonly aviso = inject(AvisoService);
  private readonly sessao = inject(SessaoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  readonly hoje = hojeEmBrasilia();
  readonly caminhoes = this.dados.caminhoes.filter(c => c.status !== 'EXCLUIDO');
  readonly enviando = signal(false);
  readonly falha = signal<string[]>([]);

  /** Na histórica basta ser usuário da empresa (o vínculo pode ter mudado desde então). */
  readonly opcoesResponsavel: OpcaoResponsavel[] = [
    { id: null, rotulo: 'Ninguém' },
    ...(this.sessao.usuarioId() !== null ? [{ id: this.sessao.usuarioId(), rotulo: 'Eu mesmo' }] : []),
    ...this.dados.motoristas.map(m => ({ id: m.id, rotulo: m.nome }))
  ];

  private readonly km = [Validators.required, inteiroValidator, Validators.min(FORMATO.km.minimo), Validators.max(FORMATO.km.maximo)];
  private readonly consumo = () => decimalPositivoValidator(FORMATO.consumo.casas, FORMATO.consumo.inteiros, FORMATO.consumo.maximo);

  readonly formulario = this.fb.nonNullable.group({
    caminhaoId: ['', Validators.required],
    responsavel: [NINGUEM],
    dataInicio: ['', Validators.required],
    dataFim: ['', Validators.required],
    origem: ['', [Validators.required, Validators.maxLength(120)]],
    destino: ['', [Validators.required, Validators.maxLength(120)]],
    valorFrete: ['', [Validators.required, decimalPositivoValidator(FORMATO.dinheiro.casas, FORMATO.dinheiro.inteiros)]],
    kmInicialVazio: ['', [inteiroValidator, Validators.min(FORMATO.km.minimo), Validators.max(FORMATO.km.maximo)]],
    kmInicialCarregado: ['', this.km],
    kmFinalCarregado: ['', this.km],
    consumoMedioVazio: ['', this.consumo()],
    consumoMedioCarregado: ['', [Validators.required, this.consumo()]]
  }, { validators: consumoVazioSeHouveVazio });

  readonly abastecimentos = new FormArray<GrupoAbastecimento>([]);
  readonly pedagios = new FormArray<GrupoPedagio>([]);
  readonly despesas = new FormArray<GrupoDespesa>([]);
  readonly limiteItens = LIMITE_ITENS_HISTORICA;

  invalido(campo: keyof typeof this.formulario.controls): boolean {
    const controle = this.formulario.controls[campo];
    return controle.invalid && (controle.touched || controle.dirty);
  }

  valorResponsavel(id: number | null): string {
    return id === null ? NINGUEM : String(id);
  }

  private dataSugerida(): string {
    return this.formulario.controls.dataInicio.value || this.hoje;
  }

  adicionar(tipo: 'abastecimento' | 'pedagio' | 'despesa'): void {
    if (tipo === 'abastecimento' && this.abastecimentos.length < LIMITE_ITENS_HISTORICA) this.abastecimentos.push(grupoAbastecimento(this.fb, this.dataSugerida()));
    if (tipo === 'pedagio' && this.pedagios.length < LIMITE_ITENS_HISTORICA) this.pedagios.push(grupoPedagio(this.fb, this.dataSugerida()));
    if (tipo === 'despesa' && this.despesas.length < LIMITE_ITENS_HISTORICA) this.despesas.push(grupoDespesa(this.fb, this.dataSugerida()));
  }

  /** Corpo do POST /api/viagens/historicas. */
  corpo(): ViagemHistoricaRequest {
    const v = this.formulario.getRawValue();
    const houveVazio = v.kmInicialVazio !== '';
    return {
      caminhaoId: Number(v.caminhaoId),
      motoristaId: v.responsavel === NINGUEM ? null : Number(v.responsavel),
      dataInicio: v.dataInicio,
      dataFim: v.dataFim,
      origem: v.origem.trim(),
      destino: v.destino.trim(),
      valorFrete: paraDecimalApi(v.valorFrete, FORMATO.dinheiro.casas) ?? '',
      kmInicialVazio: houveVazio ? Number(v.kmInicialVazio) : null,
      kmInicialCarregado: Number(v.kmInicialCarregado),
      kmFinalCarregado: Number(v.kmFinalCarregado),
      consumoMedioVazio: houveVazio ? paraDecimalApi(v.consumoMedioVazio, FORMATO.consumo.casas) : null,
      consumoMedioCarregado: paraDecimalApi(v.consumoMedioCarregado, FORMATO.consumo.casas) ?? '',
      abastecimentos: this.abastecimentos.length ? this.abastecimentos.controls.map(paraAbastecimentoRequest) : null,
      pedagios: this.pedagios.length ? this.pedagios.controls.map(paraPedagioRequest) : null,
      despesasExtras: this.despesas.length ? this.despesas.controls.map(paraDespesaRequest) : null
    };
  }

  salvar(): void {
    if (this.enviando()) return;
    this.falha.set([]);
    const listas = [this.abastecimentos, this.pedagios, this.despesas];
    if (this.formulario.invalid || listas.some(l => l.invalid)) {
      this.formulario.markAllAsTouched();
      listas.forEach(l => l.markAllAsTouched());
      return;
    }
    this.enviando.set(true);
    this.servico.registrarHistorica(this.corpo())
      .pipe(finalize(() => this.enviando.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: viagem => {
          this.aviso.mostrar('Viagem histórica registrada como concluída.');
          this.ref.close(viagem);
        },
        // 400 (qualquer item inválido: nada é gravado), 404, 409 (sobreposição; caminhão inativo/excluído antes do fim).
        error: erro => this.falha.set(normalizarFalha(erro).detalhes)
      });
  }
}
