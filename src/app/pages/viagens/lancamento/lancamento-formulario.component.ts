import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable, finalize } from 'rxjs';
import {
  AbastecimentoResponse, DespesaExtraResponse, PedagioResponse, TipoCombustivel, ViagemResponse
} from '../../../core/modelos/api.modelos';
import { LancamentosService } from '../../../core/api/lancamentos.service';
import { normalizarFalha } from '../../../core/http/falha-api';
import { AvisoService } from '../../../compartilhado/aviso.service';
import { hojeEmBrasilia } from '../../../compartilhado/formatacao';
import {
  LIMITE_DESCRICAO_DESPESA, grupoAbastecimento, grupoDespesa, grupoPedagio, paraAbastecimentoRequest, paraDespesaRequest,
  paraPedagioRequest
} from './lancamento-campos';

export type DadosLancamento =
  | { viagem: ViagemResponse; tipo: 'abastecimentos'; atual?: AbastecimentoResponse; combustivel?: TipoCombustivel }
  | { viagem: ViagemResponse; tipo: 'pedagios'; atual?: PedagioResponse }
  | { viagem: ViagemResponse; tipo: 'despesas-extras'; atual?: DespesaExtraResponse };

const TEXTOS = {
  'abastecimentos': { novo: 'Novo abastecimento', corrigir: 'Corrigir abastecimento', criado: 'Abastecimento registrado.', corrigido: 'Abastecimento corrigido.' },
  'pedagios': { novo: 'Novo pedágio', corrigir: 'Corrigir pedágio', criado: 'Pedágio registrado.', corrigido: 'Pedágio corrigido.' },
  'despesas-extras': { novo: 'Nova despesa extra', corrigir: 'Corrigir despesa extra', criado: 'Despesa extra registrada.', corrigido: 'Despesa extra corrigida.' }
} as const;

/**
 * Inclusão ou correção (PUT integral) de um lançamento. Em viagem encerrada, só o DONO
 * corrige, e a alteração fica na auditoria. Fecha com `true` para a tela recarregar o
 * detalhe da viagem (a resposta do lançamento não traz a rentabilidade).
 */
@Component({
  selector: 'app-lancamento-formulario',
  standalone: false,
  templateUrl: './lancamento-formulario.component.html'
})
export class LancamentoFormularioComponent {
  readonly dados = inject<DadosLancamento>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<LancamentoFormularioComponent, boolean>>(MatDialogRef);
  private readonly servico = inject(LancamentosService);
  private readonly aviso = inject(AvisoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  readonly hoje = hojeEmBrasilia();
  readonly limiteDescricao = LIMITE_DESCRICAO_DESPESA;
  readonly encerrada = this.dados.viagem.status !== 'EM_ANDAMENTO';
  readonly enviando = signal(false);
  readonly falha = signal<string[]>([]);

  /** Data sugerida: hoje, limitada ao fim da viagem encerrada. */
  private readonly dataPadrao = this.dados.viagem.dataFim && this.dados.viagem.dataFim < this.hoje ? this.dados.viagem.dataFim : this.hoje;

  readonly abastecimento = grupoAbastecimento(this.fb, this.dataPadrao,
    this.dados.tipo === 'abastecimentos' ? this.dados.atual : undefined,
    this.dados.tipo === 'abastecimentos' ? this.dados.combustivel : undefined);
  readonly pedagio = grupoPedagio(this.fb, this.dataPadrao, this.dados.tipo === 'pedagios' ? this.dados.atual : undefined);
  readonly despesa = grupoDespesa(this.fb, this.dataPadrao, this.dados.tipo === 'despesas-extras' ? this.dados.atual : undefined);

  get titulo(): string {
    const textos = TEXTOS[this.dados.tipo];
    return this.dados.atual ? textos.corrigir : textos.novo;
  }

  private get grupo() {
    switch (this.dados.tipo) {
      case 'abastecimentos': return this.abastecimento;
      case 'pedagios': return this.pedagio;
      default: return this.despesa;
    }
  }

  invalido(controle: { invalid: boolean; touched: boolean; dirty: boolean }): boolean {
    return controle.invalid && (controle.touched || controle.dirty);
  }

  salvar(): void {
    if (this.enviando()) return;
    this.falha.set([]);
    const grupo = this.grupo;
    if (grupo.invalid) {
      grupo.markAllAsTouched();
      return;
    }
    const { viagem, atual } = this.dados;
    let operacao: Observable<unknown>;
    switch (this.dados.tipo) {
      case 'abastecimentos': {
        const corpo = paraAbastecimentoRequest(this.abastecimento);
        operacao = atual ? this.servico.atualizar(viagem.id, 'abastecimentos', atual.id, corpo) : this.servico.criar(viagem.id, 'abastecimentos', corpo);
        break;
      }
      case 'pedagios': {
        const corpo = paraPedagioRequest(this.pedagio);
        operacao = atual ? this.servico.atualizar(viagem.id, 'pedagios', atual.id, corpo) : this.servico.criar(viagem.id, 'pedagios', corpo);
        break;
      }
      default: {
        const corpo = paraDespesaRequest(this.despesa);
        operacao = atual ? this.servico.atualizar(viagem.id, 'despesas-extras', atual.id, corpo) : this.servico.criar(viagem.id, 'despesas-extras', corpo);
      }
    }
    this.enviando.set(true);
    operacao.pipe(finalize(() => this.enviando.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.aviso.mostrar(atual ? TEXTOS[this.dados.tipo].corrigido : TEXTOS[this.dados.tipo].criado);
        this.ref.close(true);
      },
      // 400 (data fora do período, preço do diesel implausível, litros acima do tanque), 403, 404, 409 (estado da viagem).
      error: erro => this.falha.set(normalizarFalha(erro).detalhes)
    });
  }
}
