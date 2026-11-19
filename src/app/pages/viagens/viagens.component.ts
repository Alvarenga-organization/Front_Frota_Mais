import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { CaminhaoResponse, StatusViagem, ViagemResponse, ViagemResumoResponse } from '../../core/modelos/api.modelos';
import { ViagensService } from '../../core/api/viagens.service';
import { CaminhoesService } from '../../core/api/caminhoes.service';
import { SessaoService } from '../../core/sessao/sessao.service';
import { normalizarFalha } from '../../core/http/falha-api';
import { EstadoCarga } from '../../compartilhado/estado-lista/estado-lista.component';
import { JanelasService } from '../../compartilhado/janela/janelas.service';
import { CLASSE_SELO_VIAGEM, NAO_CALCULADO, ROTULO_STATUS_VIAGEM } from '../../compartilhado/formatacao';
import { AberturaViagemComponent, DadosAberturaViagem } from './abertura/abertura-viagem.component';
import { rota } from './viagem-regras';

/**
 * Viagens (Figma: "Viagens"). Lista do servidor com filtros de status e caminhão
 * (não há filtro de data nem paginação na API). DONO vê lucro e margem; para o
 * MOTORISTA esses campos vêm nulos e as colunas não aparecem.
 */
@Component({
  selector: 'app-viagens',
  standalone: false,
  templateUrl: './viagens.component.html',
  styleUrls: ['./viagens.css']
})
export class ViagensComponent {
  private readonly servico = inject(ViagensService);
  private readonly caminhoesServico = inject(CaminhoesService);
  private readonly janelas = inject(JanelasService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly ehDono = inject(SessaoService).ehDono;
  readonly rotuloStatus = ROTULO_STATUS_VIAGEM;
  readonly classeSelo = CLASSE_SELO_VIAGEM;
  readonly naoCalculado = NAO_CALCULADO;
  readonly rota = rota;
  readonly statusFiltro: StatusViagem[] = ['EM_ANDAMENTO', 'FINALIZADA', 'CANCELADA'];
  readonly telaPequena = toSignal(
    inject(BreakpointObserver).observe('(max-width: 767px)').pipe(map(r => r.matches)),
    { initialValue: false }
  );

  readonly estado = signal<EstadoCarga>('carregando');
  readonly detalhesFalha = signal<string[]>([]);
  readonly viagens = signal<ViagemResumoResponse[]>([]);
  /** Caminhões visíveis ao usuário, para o filtro e para a abertura. */
  readonly caminhoes = signal<CaminhaoResponse[]>([]);

  readonly filtroStatus = signal<StatusViagem | ''>('');
  readonly filtroCaminhao = signal<number | null>(null);

  readonly emAndamento = computed(() => this.viagens().filter(v => v.status === 'EM_ANDAMENTO'));

  constructor() {
    this.carregar();
    this.caminhoesServico.listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      // Sem caminhões o filtro só fica vazio; a lista de viagens continua utilizável.
      .subscribe({ next: lista => this.caminhoes.set(lista), error: () => this.caminhoes.set([]) });
  }

  /** GET /api/viagens com `status` e `caminhaoId` (filtros do servidor). */
  carregar(): void {
    this.estado.set('carregando');
    this.detalhesFalha.set([]);
    this.servico.listar({ status: this.filtroStatus() || null, caminhaoId: this.filtroCaminhao() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: lista => {
          this.viagens.set(lista);
          this.estado.set(lista.length ? 'sucesso' : 'vazio');
        },
        error: erro => {
          this.detalhesFalha.set(normalizarFalha(erro).detalhes);
          this.estado.set('falha');
        }
      });
  }

  filtrarStatus(valor: string): void {
    this.filtroStatus.set(valor as StatusViagem | '');
    this.carregar();
  }

  filtrarCaminhao(valor: string): void {
    this.filtroCaminhao.set(valor ? Number(valor) : null);
    this.carregar();
  }

  /** Km rodados: vazio e carregado separados (a API não devolve um total). */
  km(viagem: ViagemResumoResponse): string {
    const vazio = viagem.kmVazio === null ? '—' : viagem.kmVazio.toLocaleString('pt-BR');
    const carregado = viagem.kmCarregado === null ? '—' : viagem.kmCarregado.toLocaleString('pt-BR');
    return `${vazio} / ${carregado}`;
  }

  detalhe(viagem: ViagemResumoResponse): void {
    this.router.navigate(['/viagens', viagem.id]);
  }

  nova(): void {
    this.janelas.abrir<AberturaViagemComponent, DadosAberturaViagem, ViagemResponse>(
      AberturaViagemComponent, { caminhoes: this.caminhoes() })
      .afterClosed()
      .subscribe(aberta => {
        if (aberta) this.router.navigate(['/viagens', aberta.id]);
      });
  }
}
