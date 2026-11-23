import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs';
import { CaminhaoResponse, ManutencaoRequest, ManutencaoResponse } from '../../../core/modelos/api.modelos';
import { ManutencoesService } from '../../../core/api/manutencoes.service';
import { normalizarFalha } from '../../../core/http/falha-api';
import { AvisoService } from '../../../compartilhado/aviso.service';
import { hojeEmBrasilia } from '../../../compartilhado/formatacao';
import { FORMATO, decimalPositivoValidator, paraDecimalApi } from '../../../compartilhado/validadores';

export interface DadosFormularioManutencao {
  manutencao: ManutencaoResponse | null;
  caminhoes: CaminhaoResponse[];
}

export const LIMITE_DESCRICAO_MANUTENCAO = 500;

/**
 * Cadastro/edição de manutenção. Só os 4 campos do contrato: caminhão, data, descrição
 * **livre** (sem lista de tipos) e valor. Caminhão excluído não é oferecido.
 */
@Component({
  selector: 'app-manutencao-formulario',
  standalone: false,
  templateUrl: './manutencao-formulario.component.html'
})
export class ManutencaoFormularioComponent {
  readonly dados = inject<DadosFormularioManutencao>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<ManutencaoFormularioComponent, boolean>>(MatDialogRef);
  private readonly servico = inject(ManutencoesService);
  private readonly aviso = inject(AvisoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly hoje = hojeEmBrasilia();
  readonly limiteDescricao = LIMITE_DESCRICAO_MANUTENCAO;
  readonly caminhoes = this.dados.caminhoes.filter(c => c.status !== 'EXCLUIDO');
  readonly enviando = signal(false);
  readonly falha = signal<string[]>([]);

  readonly formulario = inject(FormBuilder).nonNullable.group({
    caminhaoId: [this.dados.manutencao ? String(this.dados.manutencao.caminhaoId) : '', Validators.required],
    data: [this.dados.manutencao?.data ?? this.hoje, Validators.required],
    descricao: [this.dados.manutencao?.descricao ?? '', [Validators.required, Validators.maxLength(LIMITE_DESCRICAO_MANUTENCAO), Validators.pattern(/\S/)]],
    valor: [this.dados.manutencao ? String(this.dados.manutencao.valor) : '',
      [Validators.required, decimalPositivoValidator(FORMATO.dinheiro.casas, FORMATO.dinheiro.inteiros)]]
  });

  get titulo(): string {
    return this.dados.manutencao ? 'Editar manutenção' : 'Nova manutenção';
  }

  invalido(campo: keyof typeof this.formulario.controls): boolean {
    const controle = this.formulario.controls[campo];
    return controle.invalid && (controle.touched || controle.dirty);
  }

  corpo(): ManutencaoRequest {
    const v = this.formulario.getRawValue();
    return {
      caminhaoId: Number(v.caminhaoId),
      data: v.data,
      descricao: v.descricao.trim(),
      valor: paraDecimalApi(v.valor, FORMATO.dinheiro.casas) ?? ''
    };
  }

  salvar(): void {
    if (this.enviando()) return;
    this.falha.set([]);
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    const atual = this.dados.manutencao;
    const operacao = atual ? this.servico.atualizar(atual.id, this.corpo()) : this.servico.criar(this.corpo());
    this.enviando.set(true);
    operacao.pipe(finalize(() => this.enviando.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.aviso.mostrar(atual ? 'Manutenção salva.' : 'Manutenção registrada.');
        this.ref.close(true);
      },
      error: erro => this.falha.set(normalizarFalha(erro).detalhes)
    });
  }
}
