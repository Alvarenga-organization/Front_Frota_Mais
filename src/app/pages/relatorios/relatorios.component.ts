import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, forkJoin } from 'rxjs';
import { FiltroPeriodo, IndicadoresPorCaminhaoResponse, IndicadoresResponse, ViagemResumoResponse } from '../../core/modelos/api.modelos';
import { IndicadoresService } from '../../core/api/indicadores.service';
import { ViagensService } from '../../core/api/viagens.service';
import { normalizarFalha } from '../../core/http/falha-api';
import { NAO_CALCULADO } from '../../compartilhado/formatacao';
import { Periodo, periodoPadrao } from '../../compartilhado/filtro-periodo/periodo';
import { rota } from '../viagens/viagem-regras';

type Estado = 'carregando' | 'sucesso' | 'falha';

/**
 * Fretes concluídos no período efetivo devolvido pelo servidor (`de`/`ate`), pela data
 * de descarga. A API não filtra viagens por data: o filtro é local, sobre a lista do servidor.
 */
export function fretesDoPeriodo(viagens: ViagemResumoResponse[], de: string | null, ate: string | null): ViagemResumoResponse[] {
  return viagens.filter(v => v.status === 'FINALIZADA' && v.dataFim !== null
    && (!de || v.dataFim >= de) && (!ate || v.dataFim <= ate));
}

/**
 * Relatórios do DONO (Figma: "Relatórios"): indicadores do período, desempenho por
 * caminhão (/por-caminhao) e rentabilidade por viagem. Nada é recalculado.
 */
@Component({
  selector: 'app-relatorios', standalone: false,
  templateUrl: './relatorios.component.html',
  styleUrls: ['../dashboard/dashboard.component.css']
})
export class RelatoriosComponent {
  private readonly indicadores = inject(IndicadoresService);
  private readonly viagensServico = inject(ViagensService);
  private readonly destroyRef = inject(DestroyRef);

  readonly naoCalculado = NAO_CALCULADO;
  readonly periodoInicial = periodoPadrao();
  readonly rota = rota;

  readonly estado = signal<Estado>('carregando');
  readonly detalhesFalha = signal<string[]>([]);
  readonly dados = signal<IndicadoresResponse | null>(null);
  readonly porCaminhao = signal<IndicadoresPorCaminhaoResponse[]>([]);
  readonly fretes = signal<ViagemResumoResponse[]>([]);

  private filtro: FiltroPeriodo = {};
  private carga?: Subscription;

  aoMudarPeriodo(evento: { periodo: Periodo; filtro: FiltroPeriodo }): void {
    this.filtro = evento.filtro;
    this.carregar();
  }

  carregar(): void {
    this.carga?.unsubscribe();
    this.estado.set('carregando');
    this.carga = forkJoin({
      geral: this.indicadores.doPeriodo(this.filtro),
      porCaminhao: this.indicadores.porCaminhao(this.filtro),
      viagens: this.viagensServico.listar({ status: 'FINALIZADA' })
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ geral, porCaminhao, viagens }) => {
        this.dados.set(geral);
        this.porCaminhao.set(porCaminhao);
        this.fretes.set(fretesDoPeriodo(viagens, geral.de, geral.ate));
        this.estado.set('sucesso');
      },
      error: erro => {
        this.detalhesFalha.set(normalizarFalha(erro).detalhes);
        this.estado.set('falha');
      }
    });
  }
}
