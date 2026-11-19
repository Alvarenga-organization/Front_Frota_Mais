import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, forkJoin, map } from 'rxjs';
import { CaminhaoResponse, FiltroPeriodo, IndicadoresResponse } from '../../core/modelos/api.modelos';
import { IndicadoresService } from '../../core/api/indicadores.service';
import { CaminhoesService } from '../../core/api/caminhoes.service';
import { normalizarFalha } from '../../core/http/falha-api';
import { NAO_CALCULADO, hojeEmBrasilia } from '../../compartilhado/formatacao';
import { Periodo, mesesAte, periodoPadrao } from '../../compartilhado/filtro-periodo/periodo';

type Estado = 'carregando' | 'sucesso' | 'falha';

export interface MesSerie {
  rotulo: string;
  receita: number;
  custo: number;
}

export interface FatiaCusto {
  rotulo: string;
  valor: number;
  cor: string;
}

const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const CORES = ['#0A56D0', '#5b8def', '#9ec0f7', '#1b3045', '#64748b', '#f2a33a'];

/**
 * Dashboard do DONO. Todos os valores vêm de GET /api/viagens/indicadores
 * (nada é recalculado). Os gráficos só **desenham** os valores devolvidos
 * (decisão aprovada: barras e rosca em CSS/SVG, sem biblioteca; série com uma
 * chamada por mês, pois a API não tem série mensal).
 */
@Component({
  selector: 'app-dashboard', standalone: false,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent {
  private readonly indicadores = inject(IndicadoresService);
  private readonly caminhoesServico = inject(CaminhoesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly naoCalculado = NAO_CALCULADO;
  readonly periodoInicial = periodoPadrao();

  readonly estado = signal<Estado>('carregando');
  readonly detalhesFalha = signal<string[]>([]);
  readonly dados = signal<IndicadoresResponse | null>(null);
  readonly caminhoes = signal<CaminhaoResponse[] | null>(null);
  readonly estadoSerie = signal<Estado>('carregando');
  readonly serie = signal<MesSerie[]>([]);

  private filtroAtual: FiltroPeriodo = {};
  private periodoAtual: Periodo = this.periodoInicial;
  private carga?: Subscription;
  private cargaSerie?: Subscription;

  /** Contagem da lista (não é cálculo financeiro): ativos / não excluídos. */
  readonly caminhoesAtivos = computed(() => {
    const lista = this.caminhoes();
    return lista ? { ativos: lista.filter(c => c.status === 'ATIVO').length, total: lista.filter(c => c.status !== 'EXCLUIDO').length } : null;
  });

  readonly maiorValorSerie = computed(() => Math.max(1, ...this.serie().flatMap(m => [m.receita, m.custo])));

  /** Fatias da rosca: componentes de custo devolvidos pelo servidor (só para desenhar). */
  readonly fatias = computed<FatiaCusto[]>(() => {
    const d = this.dados();
    if (!d) return [];
    return [
      { rotulo: 'Diesel (vazio)', valor: d.custoDieselVazio },
      { rotulo: 'Diesel (carregado)', valor: d.custoDieselCarregado },
      { rotulo: 'Arla', valor: d.custoArla },
      { rotulo: 'Pedágios', valor: d.pedagios },
      { rotulo: 'Despesas extras', valor: d.despesasExtras },
      { rotulo: 'Manutenções', valor: d.custoManutencoes }
    ].map((f, i) => ({ ...f, cor: CORES[i] }));
  });

  /** `conic-gradient` com as proporções das fatias; sem custos, anel cinza. */
  readonly gradienteRosca = computed(() => {
    const fatias = this.fatias().filter(f => f.valor > 0);
    const total = fatias.reduce((soma, f) => soma + f.valor, 0);
    if (!total) return '#e2e8f0';
    let acumulado = 0;
    const partes = fatias.map(f => {
      const inicio = (acumulado / total) * 360;
      acumulado += f.valor;
      return `${f.cor} ${inicio}deg ${(acumulado / total) * 360}deg`;
    });
    return `conic-gradient(${partes.join(', ')})`;
  });

  constructor() {
    this.caminhoesServico.listar().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: lista => this.caminhoes.set(lista), error: () => this.caminhoes.set(null) });
  }

  aoMudarPeriodo(evento: { periodo: Periodo; filtro: FiltroPeriodo }): void {
    this.filtroAtual = evento.filtro;
    this.periodoAtual = evento.periodo;
    this.carregar();
    this.carregarSerie();
  }

  carregar(): void {
    this.carga?.unsubscribe();
    this.estado.set('carregando');
    this.carga = this.indicadores.doPeriodo(this.filtroAtual).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: dados => {
        this.dados.set(dados);
        this.estado.set('sucesso');
      },
      error: erro => {
        this.dados.set(null);
        this.detalhesFalha.set(normalizarFalha(erro).detalhes);
        this.estado.set('falha');
      }
    });
  }

  /** Últimos 6 meses até o mês escolhido (ou o atual): uma chamada por mês. */
  carregarSerie(): void {
    this.cargaSerie?.unsubscribe();
    this.estadoSerie.set('carregando');
    const mesFinal = this.periodoAtual.tipo === 'mes' ? this.periodoAtual.mes : hojeEmBrasilia().slice(0, 7);
    const meses = mesesAte(mesFinal, 6);
    this.cargaSerie = forkJoin(meses.map(m => this.indicadores.doPeriodo(m).pipe(
      map(d => ({ rotulo: `${NOMES_MES[m.mes - 1]}/${String(m.ano).slice(2)}`, receita: d.receitaTotal, custo: d.custoOperacionalTotal }))
    ))).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: serie => {
        this.serie.set(serie);
        this.estadoSerie.set('sucesso');
      },
      error: () => this.estadoSerie.set('falha')
    });
  }

  altura(valor: number): number {
    return Math.round((Math.max(0, valor) / this.maiorValorSerie()) * 100);
  }
}
