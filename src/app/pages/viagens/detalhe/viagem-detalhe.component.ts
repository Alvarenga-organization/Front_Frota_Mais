import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Observable, forkJoin, of, catchError } from 'rxjs';
import {
  AbastecimentoResponse, AlteracaoViagemResponse, DespesaExtraResponse, FotografiaAnteriorResponse, MotoristaResponse,
  OrigemPrecoDiesel, PedagioResponse, TipoCombustivel, ViagemResponse
} from '../../../core/modelos/api.modelos';
import { ViagensService } from '../../../core/api/viagens.service';
import { LancamentosService, TipoLancamento } from '../../../core/api/lancamentos.service';
import { MotoristasService } from '../../../core/api/motoristas.service';
import { SessaoService } from '../../../core/sessao/sessao.service';
import { FalhaApi, normalizarFalha } from '../../../core/http/falha-api';
import { AvisoService } from '../../../compartilhado/aviso.service';
import { JanelasService } from '../../../compartilhado/janela/janelas.service';
import { ConfirmacaoComponent, DadosConfirmacao } from '../../../compartilhado/confirmacao/confirmacao.component';
import { CLASSE_SELO_VIAGEM, NAO_CALCULADO, ROTULO_STATUS_VIAGEM, formatarData, formatarMoeda } from '../../../compartilhado/formatacao';
import { acoesDaViagem, rota } from '../viagem-regras';
import { DadosEdicaoViagem, EdicaoViagemComponent } from '../edicao/edicao-viagem.component';
import { DadosFinalizacao, FinalizacaoViagemComponent } from '../finalizacao/finalizacao-viagem.component';
import { CancelamentoViagemComponent } from '../cancelamento/cancelamento-viagem.component';
import { DadosLancamento, LancamentoFormularioComponent } from '../lancamento/lancamento-formulario.component';
import { ROTULO_CAMPO_AUDITORIA, ROTULO_ENTIDADE_AUDITORIA } from './auditoria-rotulos';

type EstadoDetalhe = 'carregando' | 'sucesso' | 'nao-encontrada' | 'falha';
type EstadoAuditoria = 'fechada' | 'carregando' | 'sucesso' | 'falha';

const ROTULO_ORIGEM_PRECO: Record<OrigemPrecoDiesel, string> = {
  ABASTECIMENTOS_DA_VIAGEM: 'abastecimentos desta viagem',
  ULTIMO_PRECO_DO_CAMINHAO: 'última viagem anterior do caminhão',
  SEM_REFERENCIA: 'sem referência de preço'
};

/**
 * Detalhe da viagem (tela ausente do Figma, no padrão de cartões).
 * Mostra dados, lançamentos por tipo e, para o DONO, a rentabilidade devolvida pelo
 * servidor (nunca recalculada; nulo = "não calculado" com as pendências do servidor).
 */
@Component({
  selector: 'app-viagem-detalhe',
  standalone: false,
  templateUrl: './viagem-detalhe.component.html',
  styleUrls: ['../viagens.css', './viagem-detalhe.component.css']
})
export class ViagemDetalheComponent {
  private readonly servico = inject(ViagensService);
  private readonly lancamentos = inject(LancamentosService);
  private readonly motoristasServico = inject(MotoristasService);
  private readonly janelas = inject(JanelasService);
  private readonly aviso = inject(AvisoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  readonly ehDono = inject(SessaoService).ehDono;
  readonly rotuloStatus = ROTULO_STATUS_VIAGEM;
  readonly classeSelo = CLASSE_SELO_VIAGEM;
  readonly rotuloOrigemPreco = ROTULO_ORIGEM_PRECO;
  readonly rotuloEntidade = ROTULO_ENTIDADE_AUDITORIA;
  readonly rotuloCampo = ROTULO_CAMPO_AUDITORIA;
  readonly naoCalculado = NAO_CALCULADO;
  readonly rota = rota;

  readonly estado = signal<EstadoDetalhe>('carregando');
  readonly detalhesFalha = signal<string[]>([]);
  readonly viagem = signal<ViagemResponse | null>(null);
  readonly processando = signal(false);
  readonly acoes = computed(() => {
    const viagem = this.viagem();
    return viagem ? acoesDaViagem(viagem, this.ehDono()) : null;
  });

  readonly estadoAuditoria = signal<EstadoAuditoria>('fechada');
  readonly alteracoes = signal<AlteracaoViagemResponse[]>([]);
  readonly fotografias = signal<FotografiaAnteriorResponse[]>([]);
  readonly falhaAuditoria = signal<string[]>([]);

  constructor() {
    this.carregar();
  }

  /** GET /api/viagens/{id}. 404 = inexistente, de outra empresa ou fora do vínculo (não sugere que existe). */
  carregar(): void {
    if (!Number.isSafeInteger(this.id) || this.id <= 0) {
      this.estado.set('nao-encontrada');
      return;
    }
    if (!this.viagem()) this.estado.set('carregando');
    this.servico.obter(this.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: viagem => {
        this.viagem.set(viagem);
        this.estado.set('sucesso');
        if (this.estadoAuditoria() === 'sucesso') this.carregarAuditoria();
      },
      error: erro => {
        const falha = normalizarFalha(erro);
        this.viagem.set(null);
        this.detalhesFalha.set(falha.detalhes);
        this.estado.set(falha.status === 404 ? 'nao-encontrada' : 'falha');
      }
    });
  }

  editar(): void {
    const viagem = this.viagem();
    if (!viagem) return;
    this.motoristasDoDono().subscribe(motoristas =>
      this.aposFechar(this.janelas.abrir<EdicaoViagemComponent, DadosEdicaoViagem, ViagemResponse>(
        EdicaoViagemComponent, { viagem, motoristas }).afterClosed()));
  }

  finalizar(): void {
    const viagem = this.viagem();
    if (!viagem) return;
    // Recarrega sempre: um PUT prévio pode ter sido gravado mesmo se a finalização falhar.
    this.janelas.abrir<FinalizacaoViagemComponent, DadosFinalizacao, ViagemResponse>(FinalizacaoViagemComponent, { viagem }, 720)
      .afterClosed().subscribe(() => this.carregar());
  }

  cancelar(): void {
    const viagem = this.viagem();
    if (!viagem) return;
    this.aposFechar(this.janelas.abrir<CancelamentoViagemComponent, { viagem: ViagemResponse }, ViagemResponse>(
      CancelamentoViagemComponent, { viagem }, 720).afterClosed());
  }

  novoAbastecimento(combustivel: TipoCombustivel): void {
    const viagem = this.viagem();
    if (viagem) this.abrirLancamento({ viagem, tipo: 'abastecimentos', combustivel });
  }

  novoLancamento(tipo: 'pedagios' | 'despesas-extras'): void {
    const viagem = this.viagem();
    if (viagem) this.abrirLancamento(tipo === 'pedagios' ? { viagem, tipo } : { viagem, tipo });
  }

  /** Correção (PUT integral) de um lançamento existente. */
  corrigirLancamento(tipo: TipoLancamento, item: AbastecimentoResponse | PedagioResponse | DespesaExtraResponse): void {
    const viagem = this.viagem();
    if (!viagem) return;
    switch (tipo) {
      case 'abastecimentos': this.abrirLancamento({ viagem, tipo, atual: item as AbastecimentoResponse }); break;
      case 'pedagios': this.abrirLancamento({ viagem, tipo, atual: item as PedagioResponse }); break;
      default: this.abrirLancamento({ viagem, tipo, atual: item as DespesaExtraResponse });
    }
  }

  /** DELETE do lançamento (só em andamento), com confirmação; depois recarrega o detalhe. */
  excluirLancamento(tipo: TipoLancamento, item: { id: number; data: string }, descricao: string): void {
    const viagem = this.viagem();
    if (!viagem || this.processando()) return;
    this.janelas.abrir<ConfirmacaoComponent, DadosConfirmacao, boolean>(ConfirmacaoComponent, {
      titulo: `Excluir ${descricao}?`,
      paragrafos: [`Lançamento de ${formatarData(item.data)}. O resultado do frete será recalculado.`],
      textoConfirmar: 'Excluir',
      perigo: true
    }, 520).afterClosed().subscribe(confirmado => {
      if (!confirmado) return;
      this.processando.set(true);
      this.lancamentos.excluir(viagem.id, tipo, item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.processando.set(false);
          this.aviso.mostrar('Lançamento excluído.');
          this.carregar();
        },
        error: erro => {
          this.processando.set(false);
          this.aviso.falha(erro);
          this.carregar();
        }
      });
    });
  }

  alternarAuditoria(): void {
    if (this.estadoAuditoria() === 'fechada') this.carregarAuditoria();
    else this.estadoAuditoria.set('fechada');
  }

  /** GET .../alteracoes e .../fotografias-anteriores (só DONO). */
  carregarAuditoria(): void {
    this.estadoAuditoria.set('carregando');
    forkJoin({ alteracoes: this.servico.alteracoes(this.id), fotografias: this.servico.fotografiasAnteriores(this.id) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ alteracoes, fotografias }) => {
          this.alteracoes.set(alteracoes);
          this.fotografias.set(fotografias);
          this.estadoAuditoria.set('sucesso');
        },
        error: erro => {
          this.falhaAuditoria.set(normalizarFalha(erro).detalhes);
          this.estadoAuditoria.set('falha');
        }
      });
  }

  descricaoAbastecimento(item: AbastecimentoResponse): string {
    return `abastecimento de ${item.tipo === 'DIESEL' ? 'diesel' : 'Arla'} (${formatarMoeda(item.valorTotal)})`;
  }

  /** Lucro/margem/resultados de fotografias anteriores são JSON flexível: só exibe se for número. */
  valorFotografia(resultado: Record<string, unknown> | null, campo: string): number | null {
    const valor = resultado?.[campo];
    return typeof valor === 'number' ? valor : null;
  }

  private abrirLancamento(dados: DadosLancamento): void {
    this.aposFechar(this.janelas.abrir<LancamentoFormularioComponent, DadosLancamento, boolean>(LancamentoFormularioComponent, dados, 720)
      .afterClosed());
  }

  private aposFechar(fechamento: Observable<unknown>): void {
    fechamento.subscribe(resultado => {
      if (resultado) this.carregar();
    });
  }

  /** Motoristas para o responsável (só DONO). Falha: segue sem a lista (o atual continua como opção). */
  private motoristasDoDono(): Observable<MotoristaResponse[]> {
    if (!this.ehDono()) return of([]);
    return this.motoristasServico.listar().pipe(catchError((erro: unknown): Observable<MotoristaResponse[]> => {
      const falha: FalhaApi = normalizarFalha(erro);
      if (falha.status === 401) throw erro;
      return of([]);
    }));
  }
}
