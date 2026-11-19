import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs';
import { MotoristaResponse, ViagemResponse } from '../../../core/modelos/api.modelos';
import { ViagensService } from '../../../core/api/viagens.service';
import { SessaoService } from '../../../core/sessao/sessao.service';
import { normalizarFalha } from '../../../core/http/falha-api';
import { AvisoService } from '../../../compartilhado/aviso.service';
import { hojeEmBrasilia } from '../../../compartilhado/formatacao';
import { FORMATO, decimalPositivoValidator, inteiroValidator, paraDecimalApi } from '../../../compartilhado/validadores';
import { OpcaoResponsavel, camposAtuais, corpoAlteracao, opcoesResponsavel } from '../viagem-regras';

export interface DadosEdicaoViagem {
  viagem: ViagemResponse;
  /** Motoristas da empresa (DONO) para o responsável; vazio para o MOTORISTA. */
  motoristas: MotoristaResponse[];
}

const NINGUEM = '';

function inteiroOuNulo(valor: string): number | null {
  return valor === '' || valor === null ? null : Number(valor);
}

/**
 * Alteração de viagem em andamento (carregamento, valor do frete, dados) ou correção
 * de viagem encerrada (só DONO, auditada). Sempre PUT integral, pré-preenchido.
 */
@Component({
  selector: 'app-edicao-viagem',
  standalone: false,
  templateUrl: './edicao-viagem.component.html'
})
export class EdicaoViagemComponent {
  readonly dados = inject<DadosEdicaoViagem>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<EdicaoViagemComponent, ViagemResponse>>(MatDialogRef);
  private readonly servico = inject(ViagensService);
  private readonly aviso = inject(AvisoService);
  private readonly sessao = inject(SessaoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly viagem = this.dados.viagem;
  readonly ehDono = this.sessao.ehDono();
  readonly encerrada = this.viagem.status !== 'EM_ANDAMENTO';
  readonly cancelada = this.viagem.status === 'CANCELADA';
  readonly hoje = hojeEmBrasilia();
  readonly enviando = signal(false);
  readonly falha = signal<string[]>([]);
  readonly opcoesResponsavel: OpcaoResponsavel[] = opcoesResponsavel(
    this.viagem.caminhaoId, this.dados.motoristas, this.sessao.usuarioId(),
    { id: this.viagem.motoristaId, nome: this.viagem.motoristaNome });

  private readonly atuais = camposAtuais(this.viagem);
  private readonly consumo = () => decimalPositivoValidator(FORMATO.consumo.casas, FORMATO.consumo.inteiros, FORMATO.consumo.maximo);
  private readonly km = () => [inteiroValidator, Validators.min(FORMATO.km.minimo), Validators.max(FORMATO.km.maximo)];

  readonly formulario = inject(FormBuilder).nonNullable.group({
    dataInicio: [this.atuais.dataInicio, Validators.required],
    origem: [this.atuais.origem ?? '', Validators.maxLength(120)],
    destino: [this.atuais.destino ?? '', Validators.maxLength(120)],
    valorFrete: [this.atuais.valorFrete ?? '', decimalPositivoValidator(FORMATO.dinheiro.casas, FORMATO.dinheiro.inteiros)],
    kmInicialVazio: [this.atuais.kmInicialVazio === null ? '' : String(this.atuais.kmInicialVazio), this.km()],
    kmInicialCarregado: [this.atuais.kmInicialCarregado === null ? '' : String(this.atuais.kmInicialCarregado), this.km()],
    consumoMedioVazio: [this.atuais.consumoMedioVazio ?? '', this.consumo()],
    consumoMedioCarregado: [this.atuais.consumoMedioCarregado ?? '', this.consumo()],
    dataFim: [this.atuais.dataFim ?? '', this.cancelada ? Validators.required : []],
    kmFinalCarregado: [this.atuais.kmFinalCarregado === null ? '' : String(this.atuais.kmFinalCarregado), this.km()],
    responsavel: [this.viagem.motoristaId === null ? NINGUEM : String(this.viagem.motoristaId)]
  });

  get titulo(): string {
    if (!this.encerrada) return 'Dados da viagem';
    return this.cancelada ? 'Corrigir viagem cancelada' : 'Corrigir viagem concluída';
  }

  valorResponsavel(id: number | null): string {
    return id === null ? NINGUEM : String(id);
  }

  invalido(campo: keyof typeof this.formulario.controls): boolean {
    const controle = this.formulario.controls[campo];
    return controle.invalid && (controle.touched || controle.dirty);
  }

  salvar(): void {
    if (this.enviando()) return;
    this.falha.set([]);
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    const v = this.formulario.getRawValue();
    const corpo = corpoAlteracao(this.viagem, {
      dataInicio: v.dataInicio,
      origem: v.origem.trim() || null,
      destino: v.destino.trim() || null,
      valorFrete: paraDecimalApi(v.valorFrete, FORMATO.dinheiro.casas),
      kmInicialVazio: inteiroOuNulo(v.kmInicialVazio),
      kmInicialCarregado: inteiroOuNulo(v.kmInicialCarregado),
      consumoMedioVazio: paraDecimalApi(v.consumoMedioVazio, FORMATO.consumo.casas),
      consumoMedioCarregado: paraDecimalApi(v.consumoMedioCarregado, FORMATO.consumo.casas),
      dataFim: this.encerrada ? v.dataFim || null : null,
      kmFinalCarregado: this.encerrada ? inteiroOuNulo(v.kmFinalCarregado) : null
    }, this.ehDono, v.responsavel === NINGUEM ? null : Number(v.responsavel));
    this.enviando.set(true);
    this.servico.atualizar(this.viagem.id, corpo)
      .pipe(finalize(() => this.enviando.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: viagem => {
          this.aviso.mostrar(this.encerrada ? 'Correção salva e registrada na auditoria.' : 'Dados da viagem salvos.');
          this.ref.close(viagem);
        },
        error: erro => this.falha.set(normalizarFalha(erro).detalhes)
      });
  }
}
