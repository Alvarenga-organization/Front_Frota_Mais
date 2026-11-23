import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs';
import { CaminhaoResponse, MotoristaResponse } from '../../../core/modelos/api.modelos';
import { MotoristasService } from '../../../core/api/motoristas.service';
import { normalizarFalha } from '../../../core/http/falha-api';
import { AvisoService } from '../../../compartilhado/aviso.service';
import { caminhoesVinculaveis, paraVinculosRequest, vinculosNaoReenviaveis } from '../motorista-formulario/motorista-formulario';

export interface DadosVinculos {
  motorista: MotoristaResponse;
  caminhoes: CaminhaoResponse[];
}

/** Caminhões vinculados ao motorista: a lista marcada é enviada **completa** (PUT .../caminhoes). */
@Component({
  selector: 'app-vinculos',
  standalone: false,
  template: `
    <app-janela [titulo]="'Caminhões de ' + dados.motorista.nome"
      descricao="Marque todos os caminhões que este motorista pode operar. Desmarcar remove o acesso dele ao caminhão e às viagens do caminhão; as viagens continuam registradas.">
      @if (removidosAoSalvar.length) {
        <p class="aviso-formulario" role="note">
          <app-icone nome="alerta" [tamanho]="18"></app-icone>
          Vínculo com caminhão excluído ({{ placasRemovidas }}) não pode ser mantido e sai da lista ao salvar.
        </p>
      }
      <app-selecao-caminhoes [controle]="selecao" [caminhoes]="caminhoesOferecidos"></app-selecao-caminhoes>

      <div rodape>
        @if (falha().length) {
          <div class="aviso-formulario aviso-erro" role="alert">
            <app-icone nome="alerta" [tamanho]="18"></app-icone>
            <div>
              @for (detalhe of falha(); track $index) {
                <p>{{ detalhe }}</p>
              }
            </div>
          </div>
        }
        <div class="acoes-janela">
          <button type="button" class="botao botao-secundario" mat-dialog-close>Cancelar</button>
          <button type="button" class="botao botao-primario" (click)="salvar()" [disabled]="enviando()">
            <app-icone nome="salvar" [tamanho]="18"></app-icone>
            {{ enviando() ? 'Salvando…' : 'Salvar vínculos' }}
          </button>
        </div>
      </div>
    </app-janela>
  `
})
export class VinculosComponent {
  readonly dados = inject<DadosVinculos>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<VinculosComponent, boolean>>(MatDialogRef);
  private readonly servico = inject(MotoristasService);
  private readonly aviso = inject(AvisoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly caminhoesOferecidos = caminhoesVinculaveis(this.dados.caminhoes);
  readonly removidosAoSalvar = vinculosNaoReenviaveis(this.dados.motorista.caminhaoIds, this.dados.caminhoes);
  readonly placasRemovidas = this.removidosAoSalvar
    .map(id => this.dados.caminhoes.find(c => c.id === id)?.placa ?? `#${id}`)
    .join(', ');

  readonly selecao = new FormControl<number[]>(
    this.dados.motorista.caminhaoIds.filter(id => !this.removidosAoSalvar.includes(id)),
    { nonNullable: true }
  );

  readonly enviando = signal(false);
  /** 404 (motorista/caminhão), 409 (caminhão excluído nesse meio-tempo) etc. */
  readonly falha = signal<string[]>([]);

  /** PUT /api/motoristas/{id}/caminhoes com a lista completa marcada. */
  salvar(): void {
    if (this.enviando()) return;
    this.falha.set([]);
    this.enviando.set(true);
    this.servico.vincular(this.dados.motorista.id, paraVinculosRequest(this.selecao.value))
      .pipe(finalize(() => this.enviando.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.aviso.mostrar(`Caminhões de ${this.dados.motorista.nome} salvos.`);
          this.ref.close(true);
        },
        error: erro => this.falha.set(normalizarFalha(erro).detalhes)
      });
  }
}
