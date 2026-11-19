import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs';
import { CancelamentoViagemRequest, ViagemResponse } from '../../../core/modelos/api.modelos';
import { ViagensService } from '../../../core/api/viagens.service';
import { normalizarFalha } from '../../../core/http/falha-api';
import { AvisoService } from '../../../compartilhado/aviso.service';
import { hojeEmBrasilia } from '../../../compartilhado/formatacao';
import { FORMATO, decimalPositivoValidator, inteiroValidator, paraDecimalApi } from '../../../compartilhado/validadores';

export const LIMITE_MOTIVO = 1000;

/**
 * Cancelamento (só DONO, só em andamento). Motivo obrigatório; data (padrão hoje),
 * km final e consumos opcionais. Não há volta: cancelada não é finalizada nem reaberta.
 */
@Component({
  selector: 'app-cancelamento-viagem',
  standalone: false,
  templateUrl: './cancelamento-viagem.component.html'
})
export class CancelamentoViagemComponent {
  readonly viagem = inject<{ viagem: ViagemResponse }>(MAT_DIALOG_DATA).viagem;
  private readonly ref = inject<MatDialogRef<CancelamentoViagemComponent, ViagemResponse>>(MatDialogRef);
  private readonly servico = inject(ViagensService);
  private readonly aviso = inject(AvisoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly hoje = hojeEmBrasilia();
  readonly limiteMotivo = LIMITE_MOTIVO;
  readonly saiuVazio = this.viagem.kmInicialVazio !== null;
  readonly enviando = signal(false);
  readonly falha = signal<string[]>([]);

  private readonly consumo = () => decimalPositivoValidator(FORMATO.consumo.casas, FORMATO.consumo.inteiros, FORMATO.consumo.maximo);

  readonly formulario = inject(FormBuilder).nonNullable.group({
    motivo: ['', [Validators.required, Validators.maxLength(LIMITE_MOTIVO), Validators.pattern(/\S/)]],
    dataFim: [this.hoje],
    kmFinalCarregado: ['', [inteiroValidator, Validators.min(FORMATO.km.minimo), Validators.max(FORMATO.km.maximo)]],
    consumoMedioVazio: [this.viagem.consumoMedioVazio === null ? '' : String(this.viagem.consumoMedioVazio), this.consumo()],
    consumoMedioCarregado: [this.viagem.consumoMedioCarregado === null ? '' : String(this.viagem.consumoMedioCarregado), this.consumo()]
  });

  invalido(campo: keyof typeof this.formulario.controls): boolean {
    const controle = this.formulario.controls[campo];
    return controle.invalid && (controle.touched || controle.dirty);
  }

  corpo(): CancelamentoViagemRequest {
    const v = this.formulario.getRawValue();
    return {
      motivo: v.motivo.trim(),
      dataFim: v.dataFim || null,
      kmFinalCarregado: v.kmFinalCarregado === '' ? null : Number(v.kmFinalCarregado),
      consumoMedioVazio: this.saiuVazio ? paraDecimalApi(v.consumoMedioVazio, FORMATO.consumo.casas) : null,
      consumoMedioCarregado: paraDecimalApi(v.consumoMedioCarregado, FORMATO.consumo.casas)
    };
  }

  cancelar(): void {
    if (this.enviando()) return;
    this.falha.set([]);
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.servico.cancelar(this.viagem.id, this.corpo())
      .pipe(finalize(() => this.enviando.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: viagem => {
          this.aviso.mostrar('Viagem cancelada.');
          this.ref.close(viagem);
        },
        // 400 (lançamento depois da data), 403, 404, 409 (já finalizada ou cancelada).
        error: erro => this.falha.set(normalizarFalha(erro).detalhes)
      });
  }
}
