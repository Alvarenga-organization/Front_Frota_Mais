import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs';
import { CaminhaoResponse, StatusCaminhaoEditavel } from '../../../core/modelos/api.modelos';
import { CaminhoesService } from '../../../core/api/caminhoes.service';
import { normalizarFalha } from '../../../core/http/falha-api';
import { AvisoService } from '../../../compartilhado/aviso.service';
import { ROTULO_STATUS_CAMINHAO } from '../../../compartilhado/formatacao';
import { inteiroValidator } from '../../../compartilhado/validadores';
import {
  LIMITES_CAMINHAO, STATUS_EDITAVEIS, caminhaoCadastroIncompleto, paraCaminhaoRequest, placaValidator,
  valoresIniciaisCaminhao
} from './caminhao-formulario';

export type ModoFormularioCaminhao = 'novo' | 'editar' | 'visualizar';

export interface DadosFormularioCaminhao {
  modo: ModoFormularioCaminhao;
  caminhao: CaminhaoResponse | null;
  /** Usado por "Inativar/Reativar" quando o cadastro antigo está incompleto e precisa passar pelo formulário. */
  statusSugerido?: StatusCaminhaoEditavel;
}

/**
 * Cadastro/edição de caminhão (Figma: "Novo Caminhão" / "Informações do Veículo").
 * Campos ajustados à API: sem Cor, Renavam e Chassi; com Eixos e Tanque (opcional).
 */
@Component({
  selector: 'app-caminhao-formulario',
  standalone: false,
  templateUrl: './caminhao-formulario.component.html'
})
export class CaminhaoFormularioComponent {
  readonly dados = inject<DadosFormularioCaminhao>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<CaminhaoFormularioComponent, boolean>>(MatDialogRef);
  private readonly servico = inject(CaminhoesService);
  private readonly aviso = inject(AvisoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly limites = LIMITES_CAMINHAO;
  readonly statusEditaveis = STATUS_EDITAVEIS;
  readonly rotuloStatus = ROTULO_STATUS_CAMINHAO;
  readonly somenteLeitura = this.dados.modo === 'visualizar';
  readonly cadastroIncompleto = this.dados.caminhao !== null && caminhaoCadastroIncompleto(this.dados.caminhao);

  /** Requisição em andamento: desabilita o envio (evita cadastro duplicado). */
  readonly enviando = signal(false);
  /** `detalhes` do servidor (400 validação, 409 placa duplicada / viagem em andamento, 403, 404...). */
  readonly falha = signal<string[]>([]);

  readonly formulario = inject(FormBuilder).group({
    placa: ['', [Validators.required, Validators.maxLength(LIMITES_CAMINHAO.placaMaxDigitada), placaValidator]],
    marca: ['', [Validators.required, Validators.maxLength(LIMITES_CAMINHAO.marcaMax)]],
    modelo: ['', [Validators.required, Validators.maxLength(LIMITES_CAMINHAO.modeloMax)]],
    ano: [null as number | null, [Validators.required, inteiroValidator, Validators.min(LIMITES_CAMINHAO.anoMin), Validators.max(LIMITES_CAMINHAO.anoMax)]],
    eixos: [null as number | null, [Validators.required, inteiroValidator, Validators.min(LIMITES_CAMINHAO.eixosMin), Validators.max(LIMITES_CAMINHAO.eixosMax)]],
    capacidadeTanqueLitros: [null as number | null, [inteiroValidator, Validators.min(1)]],
    status: ['ATIVO' as StatusCaminhaoEditavel, [Validators.required]]
  });

  constructor() {
    const iniciais = valoresIniciaisCaminhao(this.dados.caminhao);
    if (this.dados.statusSugerido) iniciais.status = this.dados.statusSugerido;
    this.formulario.setValue(iniciais);
    if (this.somenteLeitura) this.formulario.disable();
  }

  get titulo(): string {
    switch (this.dados.modo) {
      case 'novo': return 'Novo caminhão';
      case 'editar': return `Editar caminhão ${this.dados.caminhao?.placa ?? ''}`.trim();
      default: return `Caminhão ${this.dados.caminhao?.placa ?? ''}`.trim();
    }
  }

  /** Mostra o erro só depois que o usuário passou pelo campo ou tentou salvar. */
  invalido(campo: keyof typeof this.formulario.controls): boolean {
    const controle = this.formulario.controls[campo];
    return controle.invalid && (controle.touched || controle.dirty);
  }

  salvar(): void {
    if (this.enviando() || this.somenteLeitura) return;
    this.falha.set([]);
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    const valor = this.formulario.getRawValue();
    const corpo = paraCaminhaoRequest({
      placa: valor.placa ?? '',
      marca: valor.marca ?? '',
      modelo: valor.modelo ?? '',
      ano: valor.ano,
      eixos: valor.eixos,
      capacidadeTanqueLitros: valor.capacidadeTanqueLitros,
      status: valor.status ?? 'ATIVO'
    });
    const caminhao = this.dados.caminhao;
    const operacao = this.dados.modo === 'novo' || !caminhao
      ? this.servico.criar(corpo)
      : this.servico.atualizar(caminhao.id, corpo);
    this.enviando.set(true);
    operacao.pipe(finalize(() => this.enviando.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: salvo => {
        this.aviso.mostrar(this.dados.modo === 'novo' ? `Caminhão ${salvo.placa} cadastrado.` : `Caminhão ${salvo.placa} salvo.`);
        this.ref.close(true);
      },
      error: erro => this.falha.set(normalizarFalha(erro).detalhes)
    });
  }
}
