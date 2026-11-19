import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { finalize, map } from 'rxjs';
import { CaminhaoResponse, ManutencaoResponse } from '../../core/modelos/api.modelos';
import { ManutencoesService } from '../../core/api/manutencoes.service';
import { CaminhoesService } from '../../core/api/caminhoes.service';
import { normalizarFalha } from '../../core/http/falha-api';
import { AvisoService } from '../../compartilhado/aviso.service';
import { EstadoCarga } from '../../compartilhado/estado-lista/estado-lista.component';
import { JanelasService } from '../../compartilhado/janela/janelas.service';
import { ConfirmacaoComponent, DadosConfirmacao } from '../../compartilhado/confirmacao/confirmacao.component';
import { formatarMoeda } from '../../compartilhado/formatacao';
import { DadosFormularioManutencao, ManutencaoFormularioComponent } from './manutencao-formulario/manutencao-formulario.component';

/**
 * Manutenções (Figma: "Manutenções"), só DONO. Filtros do servidor: caminhão,
 * período (de/até) e incluir excluídas. Caminhão excluído: só consulta.
 */
@Component({
  selector: 'app-manutencao', standalone: false,
  templateUrl: './manutencao.component.html'
})
export class ManutencaoComponent {
  private readonly servico = inject(ManutencoesService);
  private readonly caminhoesServico = inject(CaminhoesService);
  private readonly janelas = inject(JanelasService);
  private readonly aviso = inject(AvisoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly telaPequena = toSignal(
    inject(BreakpointObserver).observe('(max-width: 767px)').pipe(map(r => r.matches)),
    { initialValue: false }
  );

  readonly estado = signal<EstadoCarga>('carregando');
  readonly detalhesFalha = signal<string[]>([]);
  readonly manutencoes = signal<ManutencaoResponse[]>([]);
  /** Inclui excluídos: as manutenções antigas deles continuam consultáveis. */
  readonly caminhoes = signal<CaminhaoResponse[]>([]);
  readonly processando = signal(false);

  readonly filtroCaminhao = signal<number | null>(null);
  readonly filtroDe = signal('');
  readonly filtroAte = signal('');
  readonly incluirExcluidas = signal(false);

  private readonly caminhoesPorId = computed(() => new Map(this.caminhoes().map(c => [c.id, c])));

  constructor() {
    this.caminhoesServico.listar(true).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: lista => this.caminhoes.set(lista), error: () => this.caminhoes.set([]) });
    this.carregar();
  }

  /** GET /api/manutencoes com os filtros do servidor. */
  carregar(): void {
    this.estado.set('carregando');
    this.detalhesFalha.set([]);
    this.servico.listar({
      caminhaoId: this.filtroCaminhao(), de: this.filtroDe() || null, ate: this.filtroAte() || null, incluirExcluidas: this.incluirExcluidas()
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: lista => {
        this.manutencoes.set(lista);
        this.estado.set(lista.length ? 'sucesso' : 'vazio');
      },
      // 400 (ex.: "até" antes de "de") também cai aqui, com a mensagem do servidor.
      error: erro => {
        this.detalhesFalha.set(normalizarFalha(erro).detalhes);
        this.estado.set('falha');
      }
    });
  }

  filtrar(campo: 'caminhao' | 'de' | 'ate' | 'excluidas', valor: string | boolean): void {
    switch (campo) {
      case 'caminhao': this.filtroCaminhao.set(valor ? Number(valor) : null); break;
      case 'de': this.filtroDe.set(String(valor)); break;
      case 'ate': this.filtroAte.set(String(valor)); break;
      default: this.incluirExcluidas.set(valor === true);
    }
    this.carregar();
  }

  /** Modelo vem cruzando com a lista de caminhões (a resposta traz só a placa). */
  modelo(manutencao: ManutencaoResponse): string {
    return this.caminhoesPorId().get(manutencao.caminhaoId)?.modelo ?? '';
  }

  /** Editável se a manutenção e o caminhão não estão excluídos. */
  editavel(manutencao: ManutencaoResponse): boolean {
    return manutencao.excluidaEm === null && this.caminhoesPorId().get(manutencao.caminhaoId)?.status !== 'EXCLUIDO';
  }

  nova(): void {
    this.abrirFormulario({ manutencao: null, caminhoes: this.caminhoes() });
  }

  editar(manutencao: ManutencaoResponse): void {
    this.abrirFormulario({ manutencao, caminhoes: this.caminhoes() });
  }

  excluir(manutencao: ManutencaoResponse): void {
    if (this.processando()) return;
    this.janelas.abrir<ConfirmacaoComponent, DadosConfirmacao, boolean>(ConfirmacaoComponent, {
      titulo: 'Excluir manutenção?',
      paragrafos: [
        `${manutencao.descricao} (${manutencao.placa}, ${formatarMoeda(manutencao.valor)}).`,
        'A manutenção sai dos resultados do período. O registro fica guardado e aparece com "Mostrar excluídas".'
      ],
      textoConfirmar: 'Excluir',
      perigo: true
    }, 520).afterClosed().subscribe(confirmado => {
      if (!confirmado) return;
      this.processando.set(true);
      this.servico.excluir(manutencao.id)
        .pipe(finalize(() => this.processando.set(false)), takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.aviso.mostrar('Manutenção excluída.');
            this.carregar();
          },
          error: erro => {
            this.aviso.falha(erro);
            this.carregar();
          }
        });
    });
  }

  private abrirFormulario(dados: DadosFormularioManutencao): void {
    this.janelas.abrir<ManutencaoFormularioComponent, DadosFormularioManutencao, boolean>(ManutencaoFormularioComponent, dados, 720)
      .afterClosed().subscribe(salvou => {
        if (salvou) this.carregar();
      });
  }
}
