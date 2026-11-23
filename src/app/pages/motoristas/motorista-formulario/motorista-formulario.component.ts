import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable, finalize } from 'rxjs';
import { CaminhaoResponse, MotoristaResponse } from '../../../core/modelos/api.modelos';
import { MotoristasService } from '../../../core/api/motoristas.service';
import { normalizarFalha } from '../../../core/http/falha-api';
import { AvisoService } from '../../../compartilhado/aviso.service';
import { ConfirmacaoComponent, DadosConfirmacao } from '../../../compartilhado/confirmacao/confirmacao.component';
import { JanelasService } from '../../../compartilhado/janela/janelas.service';
import { ROTULO_SITUACAO_MOTORISTA } from '../../../compartilhado/formatacao';
import { LIMITES_MOTORISTA, caminhoesVinculaveis, paraAtualizacaoRequest, paraMotoristaRequest } from './motorista-formulario';

export interface DadosFormularioMotorista {
  /** Nulo = novo motorista (convite). */
  motorista: MotoristaResponse | null;
  /** Caminhões da empresa (GET /api/caminhoes). */
  caminhoes: CaminhaoResponse[];
}

/**
 * Novo motorista (nome, e-mail, caminhões → convite por e-mail) ou edição
 * (nome e ativação de conta já ativada). Sem CPF, CNH, telefone ou endereço.
 */
@Component({
  selector: 'app-motorista-formulario',
  standalone: false,
  templateUrl: './motorista-formulario.component.html'
})
export class MotoristaFormularioComponent {
  readonly dados = inject<DadosFormularioMotorista>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<MotoristaFormularioComponent, boolean>>(MatDialogRef);
  private readonly servico = inject(MotoristasService);
  private readonly aviso = inject(AvisoService);
  private readonly janelas = inject(JanelasService);
  private readonly destroyRef = inject(DestroyRef);

  readonly limites = LIMITES_MOTORISTA;
  readonly rotuloSituacao = ROTULO_SITUACAO_MOTORISTA;
  readonly novo = this.dados.motorista === null;
  readonly pendente = this.dados.motorista?.situacao === 'CONVITE_PENDENTE';
  readonly caminhoesOferecidos = caminhoesVinculaveis(this.dados.caminhoes);

  readonly enviando = signal(false);
  /** `detalhes` do servidor: 400, 409 (e-mail existente, caminhão excluído), 503 (e-mail não configurado: nada gravado). */
  readonly falha = signal<string[]>([]);

  private readonly fb = inject(FormBuilder).nonNullable;
  readonly formulario = this.fb.group({
    nome: [this.dados.motorista?.nome ?? '', [Validators.required, Validators.maxLength(LIMITES_MOTORISTA.nomeMax)]],
    email: [
      { value: this.dados.motorista?.email ?? '', disabled: !this.novo },
      [Validators.required, Validators.email, Validators.maxLength(LIMITES_MOTORISTA.emailMax)]
    ],
    caminhaoIds: [[] as number[]],
    ativo: [{ value: this.dados.motorista?.situacao === 'ATIVO', disabled: this.pendente }]
  });

  get titulo(): string {
    return this.novo ? 'Novo motorista' : `Editar ${this.dados.motorista?.nome ?? 'motorista'}`;
  }

  invalido(campo: 'nome' | 'email'): boolean {
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
    const valor = this.formulario.getRawValue();
    const motorista = this.dados.motorista;
    if (!motorista) {
      this.enviar(this.servico.convidar(paraMotoristaRequest(valor.nome, valor.email, valor.caminhaoIds)),
        `Convite enviado para ${valor.email.trim()}.`);
      return;
    }
    const corpo = paraAtualizacaoRequest(motorista, valor.nome, valor.ativo);
    const desativando = motorista.situacao === 'ATIVO' && !corpo.ativo;
    if (!desativando) {
      this.enviar(this.servico.atualizar(motorista.id, corpo), 'Motorista salvo.');
      return;
    }
    this.janelas.abrir<ConfirmacaoComponent, DadosConfirmacao, boolean>(ConfirmacaoComponent, {
      titulo: `Desativar ${motorista.nome}?`,
      paragrafos: [
        'O motorista perde o acesso ao Frota+ imediatamente, mesmo que esteja conectado agora.',
        'As viagens e os lançamentos dele continuam registrados.',
        'Você pode reativar a conta depois.'
      ],
      textoConfirmar: 'Desativar',
      perigo: true
    }, 520).afterClosed().subscribe(confirmado => {
      if (confirmado) this.enviar(this.servico.atualizar(motorista.id, corpo), `${motorista.nome} desativado.`);
    });
  }

  private enviar(operacao: Observable<MotoristaResponse>, mensagemSucesso: string): void {
    this.enviando.set(true);
    operacao.pipe(finalize(() => this.enviando.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.aviso.mostrar(mensagemSucesso);
        this.ref.close(true);
      },
      error: erro => this.falha.set(normalizarFalha(erro).detalhes)
    });
  }
}
