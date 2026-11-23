import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable, finalize, of, switchMap, tap } from 'rxjs';
import { FinalizacaoViagemRequest, ViagemResponse } from '../../../core/modelos/api.modelos';
import { ViagensService } from '../../../core/api/viagens.service';
import { SessaoService } from '../../../core/sessao/sessao.service';
import { normalizarFalha } from '../../../core/http/falha-api';
import { AvisoService } from '../../../compartilhado/aviso.service';
import { hojeEmBrasilia } from '../../../compartilhado/formatacao';
import { FORMATO, decimalPositivoValidator, inteiroValidator, paraDecimalApi } from '../../../compartilhado/validadores';
import { FaltasParaFinalizar, corpoAlteracao, faltasParaFinalizar, temFaltas } from '../viagem-regras';

export interface DadosFinalizacao {
  viagem: ViagemResponse;
}

/**
 * Finalização (na descarga). Se faltarem valor do frete, origem, destino ou km do
 * carregamento, a tela coleta e envia antes um PUT com eles (o corpo da finalização
 * não os aceita) e só então chama POST .../finalizar. Erros 400 mostram a lista do servidor.
 */
@Component({
  selector: 'app-finalizacao-viagem',
  standalone: false,
  templateUrl: './finalizacao-viagem.component.html'
})
export class FinalizacaoViagemComponent {
  private readonly dados = inject<DadosFinalizacao>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<FinalizacaoViagemComponent, ViagemResponse>>(MatDialogRef);
  private readonly servico = inject(ViagensService);
  private readonly aviso = inject(AvisoService);
  private readonly ehDono = inject(SessaoService).ehDono();
  private readonly destroyRef = inject(DestroyRef);

  readonly viagem = this.dados.viagem;
  readonly hoje = hojeEmBrasilia();
  readonly faltas: FaltasParaFinalizar = faltasParaFinalizar(this.viagem);
  readonly coletaFaltas = temFaltas(this.faltas);
  readonly saiuVazio = this.viagem.kmInicialVazio !== null;
  readonly enviando = signal(false);
  readonly falha = signal<string[]>([]);
  /** O PUT prévio foi gravado, mas a finalização falhou: a tela de origem precisa recarregar. */
  readonly dadosGravados = signal(false);

  private readonly consumo = () => decimalPositivoValidator(FORMATO.consumo.casas, FORMATO.consumo.inteiros, FORMATO.consumo.maximo);
  private readonly km = [Validators.required, inteiroValidator, Validators.min(FORMATO.km.minimo), Validators.max(FORMATO.km.maximo)];

  readonly formulario = inject(FormBuilder).nonNullable.group({
    dataFim: [this.hoje, Validators.required],
    kmFinalCarregado: ['', this.km],
    consumoMedioVazio: [this.viagem.consumoMedioVazio === null ? '' : String(this.viagem.consumoMedioVazio),
      this.saiuVazio ? [Validators.required, this.consumo()] : []],
    consumoMedioCarregado: [this.viagem.consumoMedioCarregado === null ? '' : String(this.viagem.consumoMedioCarregado),
      [Validators.required, this.consumo()]],
    // Dados que precisam estar gravados antes (enviados pelo PUT prévio, se faltarem).
    valorFrete: ['', this.faltas.valorFrete ? [Validators.required, decimalPositivoValidator(FORMATO.dinheiro.casas, FORMATO.dinheiro.inteiros)] : []],
    origem: ['', this.faltas.origem ? [Validators.required, Validators.maxLength(120)] : []],
    destino: ['', this.faltas.destino ? [Validators.required, Validators.maxLength(120)] : []],
    kmInicialCarregado: ['', this.faltas.kmInicialCarregado ? this.km : []]
  });

  invalido(campo: keyof typeof this.formulario.controls): boolean {
    const controle = this.formulario.controls[campo];
    return controle.invalid && (controle.touched || controle.dirty);
  }

  /** Corpo do POST .../finalizar. */
  corpoFinalizacao(): FinalizacaoViagemRequest {
    const v = this.formulario.getRawValue();
    return {
      dataFim: v.dataFim,
      kmFinalCarregado: Number(v.kmFinalCarregado),
      consumoMedioVazio: this.saiuVazio ? paraDecimalApi(v.consumoMedioVazio, FORMATO.consumo.casas) : null,
      consumoMedioCarregado: paraDecimalApi(v.consumoMedioCarregado, FORMATO.consumo.casas)
    };
  }

  finalizar(): void {
    if (this.enviando()) return;
    this.falha.set([]);
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.completarDados()
      .pipe(
        switchMap(() => this.servico.finalizar(this.viagem.id, this.corpoFinalizacao())),
        finalize(() => this.enviando.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: viagem => {
          this.aviso.mostrar('Viagem finalizada.');
          this.ref.close(viagem);
        },
        error: erro => this.falha.set(normalizarFalha(erro).detalhes)
      });
  }

  /** PUT prévio com os dados que faltam (integral, mantendo o responsável atual). */
  private completarDados(): Observable<unknown> {
    if (!this.coletaFaltas || this.dadosGravados()) return of(null);
    const v = this.formulario.getRawValue();
    const corpo = corpoAlteracao(this.viagem, {
      ...(this.faltas.valorFrete ? { valorFrete: paraDecimalApi(v.valorFrete, FORMATO.dinheiro.casas) } : {}),
      ...(this.faltas.origem ? { origem: v.origem.trim() } : {}),
      ...(this.faltas.destino ? { destino: v.destino.trim() } : {}),
      ...(this.faltas.kmInicialCarregado ? { kmInicialCarregado: Number(v.kmInicialCarregado) } : {})
    }, this.ehDono);
    return this.servico.atualizar(this.viagem.id, corpo).pipe(tap(() => this.dadosGravados.set(true)));
  }
}
