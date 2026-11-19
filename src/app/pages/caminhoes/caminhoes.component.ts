import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Observable, finalize, map } from 'rxjs';
import { CaminhaoResponse, StatusCaminhao } from '../../core/modelos/api.modelos';
import { SessaoService } from '../../core/sessao/sessao.service';
import { CaminhoesService } from '../../core/api/caminhoes.service';
import { normalizarFalha } from '../../core/http/falha-api';
import { AvisoService } from '../../compartilhado/aviso.service';
import { EstadoCarga } from '../../compartilhado/estado-lista/estado-lista.component';
import { ConfirmacaoComponent, DadosConfirmacao } from '../../compartilhado/confirmacao/confirmacao.component';
import { JanelasService } from '../../compartilhado/janela/janelas.service';
import { ROTULO_STATUS_CAMINHAO } from '../../compartilhado/formatacao';
import { CaminhaoFormularioComponent, DadosFormularioCaminhao } from './caminhao-formulario/caminhao-formulario.component';
import { caminhaoCadastroIncompleto, paraCaminhaoRequest, valoresIniciaisCaminhao } from './caminhao-formulario/caminhao-formulario';

const CLASSE_SELO: Record<StatusCaminhao, string> = {
  ATIVO: 'selo',
  INATIVO: 'selo selo-neutro',
  EXCLUIDO: 'selo selo-perigo'
};

/**
 * Caminhões (Figma: "Caminhões" e "Caminhões - Mobile").
 * DONO administra; MOTORISTA só consulta os vinculados (o servidor já devolve a lista filtrada).
 */
@Component({
  selector: 'app-caminhoes', standalone: false,
  templateUrl: './caminhoes.component.html'
})
export class CaminhoesComponent {
  private readonly sessao = inject(SessaoService);
  private readonly servico = inject(CaminhoesService);
  private readonly janelas = inject(JanelasService);
  private readonly aviso = inject(AvisoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly ehDono = this.sessao.ehDono;
  readonly rotuloStatus = ROTULO_STATUS_CAMINHAO;
  readonly classeSelo = CLASSE_SELO;
  readonly telaPequena = toSignal(
    inject(BreakpointObserver).observe('(max-width: 767px)').pipe(map(r => r.matches)),
    { initialValue: false }
  );

  readonly estado = signal<EstadoCarga>('carregando');
  readonly detalhesFalha = signal<string[]>([]);
  private readonly caminhoes = signal<CaminhaoResponse[]>([]);
  /** Uma operação (inativar, reativar, excluir) em andamento: bloqueia novas ações. */
  readonly processando = signal(false);

  /** Parâmetro `incluirExcluidos` (só o DONO; o servidor ignora para o MOTORISTA). */
  readonly incluirExcluidos = signal(false);
  readonly busca = signal('');

  readonly visiveis = computed(() => {
    const termo = this.busca().trim().toLowerCase();
    return this.caminhoes()
      .filter(c => !termo || [c.placa, c.marca ?? '', c.modelo].some(t => t.toLowerCase().includes(termo)));
  });

  readonly totalCadastrados = computed(() => this.caminhoes().filter(c => c.status !== 'EXCLUIDO').length);

  constructor() {
    this.carregar();
  }

  /** GET /api/caminhoes (com `incluirExcluidos=true` quando a opção está marcada). */
  carregar(): void {
    this.estado.set('carregando');
    this.detalhesFalha.set([]);
    this.servico.listar(this.ehDono() && this.incluirExcluidos())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: lista => {
          this.caminhoes.set(lista);
          this.estado.set(lista.length ? 'sucesso' : 'vazio');
        },
        error: erro => {
          this.detalhesFalha.set(normalizarFalha(erro).detalhes);
          this.estado.set('falha');
        }
      });
  }

  alternarExcluidos(marcado: boolean): void {
    this.incluirExcluidos.set(marcado);
    this.carregar();
  }

  /** Caminhões antigos podem vir sem marca (o servidor aceita nulo até a próxima edição). */
  descricao(caminhao: CaminhaoResponse): string {
    return caminhao.marca ? `${caminhao.marca} ${caminhao.modelo}` : `${caminhao.modelo} (marca não informada)`;
  }

  novo(): void {
    this.abrirFormulario({ modo: 'novo', caminhao: null });
  }

  abrir(caminhao: CaminhaoResponse): void {
    const podeEditar = this.ehDono() && caminhao.status !== 'EXCLUIDO';
    this.abrirFormulario({ modo: podeEditar ? 'editar' : 'visualizar', caminhao });
  }

  /** Inativar/reativar é um PUT com todos os campos atuais e o novo status. */
  alternarStatus(caminhao: CaminhaoResponse): void {
    if (this.processando()) return;
    const novoStatus = caminhao.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    if (caminhaoCadastroIncompleto(caminhao)) {
      // O PUT exige marca e eixos: o usuário completa o cadastro no formulário.
      this.abrirFormulario({ modo: 'editar', caminhao, statusSugerido: novoStatus });
      return;
    }
    const corpo = paraCaminhaoRequest({ ...valoresIniciaisCaminhao(caminhao), status: novoStatus });
    const enviar = () => this.executar(this.servico.atualizar(caminhao.id, corpo),
      novoStatus === 'ATIVO' ? `Caminhão ${caminhao.placa} reativado.` : `Caminhão ${caminhao.placa} inativado.`);
    if (novoStatus === 'ATIVO') {
      enviar();
      return;
    }
    this.confirmar({
      titulo: `Inativar o caminhão ${caminhao.placa}?`,
      paragrafos: [
        'Um caminhão inativo continua consultável e pode receber manutenções, mas não abre novas viagens.',
        'Se houver uma viagem em andamento neste caminhão, ela precisa ser finalizada ou cancelada antes.',
        'Você pode reativá-lo depois.'
      ],
      textoConfirmar: 'Inativar'
    }, enviar);
  }

  /** Exclusão lógica (DELETE /api/caminhoes/{id}). */
  excluir(caminhao: CaminhaoResponse): void {
    if (this.processando()) return;
    this.confirmar({
      titulo: `Excluir o caminhão ${caminhao.placa}?`,
      paragrafos: [
        'O caminhão será retirado da operação: sai da lista padrão, não abre viagens, não recebe manutenções e não pode ser vinculado a motoristas.',
        'Todo o histórico (viagens, lançamentos, manutenções e resultados) é preservado e continua consultável.',
        'A exclusão não pode ser desfeita: o caminhão não volta a ficar ativo pelo fluxo normal.',
        'Se houver uma viagem em andamento neste caminhão, ela precisa ser finalizada ou cancelada antes.'
      ],
      textoConfirmar: 'Excluir caminhão',
      perigo: true
    }, () => this.executar(this.servico.excluir(caminhao.id), `Caminhão ${caminhao.placa} excluído.`));
  }

  /**
   * Executa a operação e recarrega a lista no fim, com sucesso ou falha
   * (em 403/404/409 o estado no servidor pode ter mudado).
   */
  private executar(operacao: Observable<unknown>, mensagemSucesso: string): void {
    this.processando.set(true);
    operacao.pipe(finalize(() => this.processando.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.aviso.mostrar(mensagemSucesso);
        this.carregar();
      },
      error: erro => {
        this.aviso.falha(erro);
        this.carregar();
      }
    });
  }

  private abrirFormulario(dados: DadosFormularioCaminhao): void {
    this.janelas.abrir<CaminhaoFormularioComponent, DadosFormularioCaminhao, boolean>(CaminhaoFormularioComponent, dados)
      .afterClosed()
      .subscribe(salvou => {
        if (salvou) this.carregar();
      });
  }

  private confirmar(dados: DadosConfirmacao, aoConfirmar: () => void): void {
    this.janelas.abrir<ConfirmacaoComponent, DadosConfirmacao, boolean>(ConfirmacaoComponent, dados, 520)
      .afterClosed()
      .subscribe(confirmado => {
        if (confirmado) aoConfirmar();
      });
  }
}
