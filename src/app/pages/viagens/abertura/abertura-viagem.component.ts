import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize, startWith } from 'rxjs';
import { AberturaViagemRequest, CaminhaoResponse, MotoristaResponse, ViagemResponse } from '../../../core/modelos/api.modelos';
import { ViagensService } from '../../../core/api/viagens.service';
import { MotoristasService } from '../../../core/api/motoristas.service';
import { SessaoService } from '../../../core/sessao/sessao.service';
import { normalizarFalha } from '../../../core/http/falha-api';
import { AvisoService } from '../../../compartilhado/aviso.service';
import { hojeEmBrasilia } from '../../../compartilhado/formatacao';
import { FORMATO, decimalPositivoValidator, inteiroValidator, paraDecimalApi } from '../../../compartilhado/validadores';
import { GrupoAbastecimento, grupoAbastecimento, paraAbastecimentoRequest } from '../lancamento/lancamento-campos';
import { caminhoesParaAbertura, opcoesResponsavel } from '../viagem-regras';

export interface DadosAberturaViagem {
  /** Caminhões visíveis ao usuário (GET /api/caminhoes); só os ATIVO são oferecidos. */
  caminhoes: CaminhaoResponse[];
}

export type Saida = 'VAZIO' | 'CARREGADO';

/** Valor especial do select de responsável para "ninguém" (select HTML não guarda null). */
const NINGUEM = '';

/**
 * Abertura de viagem (Figma: "Detalhes do Trajeto", ajustado à API).
 * Obrigatórios: caminhão, data de início e um km inicial (vazio ou carregado).
 * Opcionais: origem, destino, valor do frete, consumos e abastecimentos anteriores.
 */
@Component({
  selector: 'app-abertura-viagem',
  standalone: false,
  templateUrl: './abertura-viagem.component.html'
})
export class AberturaViagemComponent {
  private readonly dados = inject<DadosAberturaViagem>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<AberturaViagemComponent, ViagemResponse>>(MatDialogRef);
  private readonly servico = inject(ViagensService);
  private readonly motoristasServico = inject(MotoristasService);
  private readonly aviso = inject(AvisoService);
  private readonly sessao = inject(SessaoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  readonly ehDono = this.sessao.ehDono;
  readonly hoje = hojeEmBrasilia();
  readonly caminhoes = caminhoesParaAbertura(this.dados.caminhoes);
  readonly enviando = signal(false);
  readonly falha = signal<string[]>([]);
  readonly maisInformacoes = signal(false);
  /** Motoristas da empresa (só DONO), para indicar o responsável. */
  private readonly motoristas = signal<MotoristaResponse[]>([]);
  readonly falhaMotoristas = signal(false);

  readonly formulario = this.fb.nonNullable.group({
    caminhaoId: [this.caminhoes.length === 1 ? String(this.caminhoes[0].id) : '', Validators.required],
    responsavel: [NINGUEM],
    dataInicio: [this.hoje, Validators.required],
    saida: ['' as Saida | '', Validators.required],
    km: ['', [Validators.required, inteiroValidator, Validators.min(FORMATO.km.minimo), Validators.max(FORMATO.km.maximo)]],
    origem: ['', Validators.maxLength(120)],
    destino: ['', Validators.maxLength(120)],
    valorFrete: ['', decimalPositivoValidator(FORMATO.dinheiro.casas, FORMATO.dinheiro.inteiros)],
    consumoMedioVazio: ['', decimalPositivoValidator(FORMATO.consumo.casas, FORMATO.consumo.inteiros, FORMATO.consumo.maximo)],
    consumoMedioCarregado: ['', decimalPositivoValidator(FORMATO.consumo.casas, FORMATO.consumo.inteiros, FORMATO.consumo.maximo)]
  });

  readonly abastecimentos = new FormArray<GrupoAbastecimento>([]);

  private readonly caminhaoSelecionado = toSignal(
    this.formulario.controls.caminhaoId.valueChanges.pipe(startWith(this.formulario.controls.caminhaoId.value)),
    { initialValue: '' }
  );
  readonly saida = toSignal(this.formulario.controls.saida.valueChanges, { initialValue: '' as Saida | '' });

  readonly opcoesResponsavel = computed(() => {
    const id = this.caminhaoSelecionado();
    return opcoesResponsavel(id ? Number(id) : null, this.motoristas(), this.sessao.usuarioId());
  });

  constructor() {
    if (this.ehDono()) {
      this.motoristasServico.listar().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: lista => this.motoristas.set(lista),
        // Sem a lista, o DONO ainda pode abrir sem responsável ou em seu próprio nome.
        error: () => this.falhaMotoristas.set(true)
      });
    }
    // Responsável escolhido deixa de valer se o caminhão mudar.
    this.formulario.controls.caminhaoId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formulario.controls.responsavel.setValue(NINGUEM));
  }

  invalido(campo: keyof typeof this.formulario.controls): boolean {
    const controle = this.formulario.controls[campo];
    return controle.invalid && (controle.touched || controle.dirty);
  }

  adicionarAbastecimento(): void {
    this.maisInformacoes.set(true);
    this.abastecimentos.push(grupoAbastecimento(this.fb, this.formulario.controls.dataInicio.value || this.hoje));
  }

  removerAbastecimento(indice: number): void {
    this.abastecimentos.removeAt(indice);
  }

  valorResponsavel(id: number | null): string {
    return id === null ? NINGUEM : String(id);
  }

  /** Corpo do POST /api/viagens. Exportado para teste. */
  montarRequest(): AberturaViagemRequest {
    const v = this.formulario.getRawValue();
    const vazio = v.saida === 'VAZIO';
    const km = Number(v.km);
    return {
      caminhaoId: Number(v.caminhaoId),
      // MOTORISTA: o responsável é sempre ele (o servidor define); não envia outro id.
      motoristaId: this.ehDono() && v.responsavel !== NINGUEM ? Number(v.responsavel) : null,
      dataInicio: v.dataInicio,
      origem: v.origem.trim() || null,
      destino: v.destino.trim() || null,
      valorFrete: paraDecimalApi(v.valorFrete, FORMATO.dinheiro.casas),
      kmInicialVazio: vazio ? km : null,
      kmInicialCarregado: vazio ? null : km,
      // Consumo vazio só existe com deslocamento vazio (400 caso contrário).
      consumoMedioVazio: vazio ? paraDecimalApi(v.consumoMedioVazio, FORMATO.consumo.casas) : null,
      consumoMedioCarregado: paraDecimalApi(v.consumoMedioCarregado, FORMATO.consumo.casas),
      abastecimentos: this.abastecimentos.length ? this.abastecimentos.controls.map(paraAbastecimentoRequest) : null
    };
  }

  abrir(): void {
    if (this.enviando()) return;
    this.falha.set([]);
    if (this.formulario.invalid || this.abastecimentos.invalid) {
      this.formulario.markAllAsTouched();
      this.abastecimentos.markAllAsTouched();
      if (this.abastecimentos.invalid) this.maisInformacoes.set(true);
      return;
    }
    this.enviando.set(true);
    this.servico.abrir(this.montarRequest())
      .pipe(finalize(() => this.enviando.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: viagem => {
          this.aviso.mostrar(`Viagem aberta para o caminhão ${viagem.placa}.`);
          this.ref.close(viagem);
        },
        // 400 (datas, km, abastecimento inválido), 403, 404, 409 (caminhão com viagem em andamento, sobreposição...).
        error: erro => this.falha.set(normalizarFalha(erro).detalhes)
      });
  }
}
