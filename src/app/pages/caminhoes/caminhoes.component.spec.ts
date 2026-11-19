import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { CaminhoesModule } from './caminhoes.module';
import { CaminhoesComponent } from './caminhoes.component';
import { JanelasService } from '../../compartilhado/janela/janelas.service';
import { AvisoService } from '../../compartilhado/aviso.service';
import { ConfirmacaoComponent, DadosConfirmacao } from '../../compartilhado/confirmacao/confirmacao.component';
import { CaminhaoFormularioComponent } from './caminhao-formulario/caminhao-formulario.component';
import { CaminhaoResponse } from '../../core/modelos/api.modelos';
import { CAMINHOES_DONO_MOCK, CAMINHOES_MOTORISTA_MOCK } from '../../../testes/dados/caminhoes.mock';
import { entrarComo, limparSessao, todos } from '../../../testes/sessao-de-teste';

const SEM_EXCLUIDOS = CAMINHOES_DONO_MOCK.filter(c => c.status !== 'EXCLUIDO');

describe('CaminhoesComponent', () => {
  let janelas: jasmine.SpyObj<JanelasService>;
  let aviso: jasmine.SpyObj<AvisoService>;
  let controle: HttpTestingController;

  beforeEach(async () => {
    limparSessao();
    janelas = jasmine.createSpyObj<JanelasService>('JanelasService', ['abrir']);
    janelas.abrir.and.returnValue({ afterClosed: () => of(true) } as never);
    aviso = jasmine.createSpyObj<AvisoService>('AvisoService', ['falha', 'mostrar']);
    await TestBed.configureTestingModule({
      imports: [CaminhoesModule],
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: JanelasService, useValue: janelas },
        { provide: AvisoService, useValue: aviso }
      ]
    }).compileComponents();
    controle = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    controle.verify();
    limparSessao();
  });

  /** Cria a tela e responde o GET inicial. */
  function criar(lista: CaminhaoResponse[] = SEM_EXCLUIDOS): ComponentFixture<CaminhoesComponent> {
    const fixture = TestBed.createComponent(CaminhoesComponent);
    fixture.detectChanges();
    const req = controle.expectOne(r => r.url === '/api/caminhoes');
    expect(req.request.method).toBe('GET');
    req.flush(lista);
    fixture.detectChanges();
    return fixture;
  }

  function placas(fixture: ComponentFixture<CaminhoesComponent>): string[] {
    return todos(fixture.nativeElement, '[data-placa]').map(e => e.getAttribute('data-placa') ?? '');
  }

  describe('estados da tela', () => {
    beforeEach(() => entrarComo('DONO'));

    it('carregando enquanto a resposta não chega', () => {
      const fixture = TestBed.createComponent(CaminhoesComponent);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Carregando');
      controle.expectOne('/api/caminhoes').flush([]);
    });

    it('lista vazia não é erro', () => {
      const fixture = criar([]);
      expect(fixture.componentInstance.estado()).toBe('vazio');
      expect(fixture.nativeElement.textContent).toContain('Nenhum caminhão cadastrado');
    });

    it('falha mostra os detalhes e "Tentar de novo" refaz a consulta', () => {
      const fixture = TestBed.createComponent(CaminhoesComponent);
      fixture.detectChanges();
      controle.expectOne('/api/caminhoes').error(new ProgressEvent('error'), { status: 0 });
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Não foi possível falar com o servidor');
      (el.querySelector('.estado-falha button') as HTMLButtonElement).click();
      controle.expectOne('/api/caminhoes').flush(SEM_EXCLUIDOS);
      fixture.detectChanges();
      expect(placas(fixture).length).toBe(3);
    });
  });

  describe('perfil DONO', () => {
    beforeEach(() => entrarComo('DONO'));

    it('mostra "+ Novo Caminhão" e as ações de gestão', () => {
      const el: HTMLElement = criar().nativeElement;
      expect(el.querySelector('.botao-cabecalho')?.textContent).toContain('Novo Caminhão');
      expect(todos(el, '.acao-editar').length).toBe(3);
      expect(todos(el, '.acao-status').length).toBe(3);
      expect(todos(el, '.acao-excluir').length).toBe(3);
    });

    it('"Mostrar excluídos" consulta o servidor com incluirExcluidos=true', () => {
      const fixture = criar();
      expect(placas(fixture)).toEqual(['BCB8H89', 'DEM1B22', 'QIT2E40']);
      fixture.componentInstance.alternarExcluidos(true);
      const req = controle.expectOne(r => r.url === '/api/caminhoes');
      expect(req.request.params.get('incluirExcluidos')).toBe('true');
      req.flush(CAMINHOES_DONO_MOCK);
      fixture.detectChanges();
      expect(placas(fixture)).toEqual(['BCB8H89', 'DEM0A01', 'DEM1B22', 'QIT2E40']);
      const linhaExcluida = fixture.nativeElement.querySelector('[data-placa="DEM0A01"]') as HTMLElement;
      expect(linhaExcluida.querySelector('.acao-excluir')).toBeNull();
      expect(linhaExcluida.querySelector('.acao-visualizar')).not.toBeNull();
    });

    it('a consulta padrão não envia incluirExcluidos', () => {
      const fixture = TestBed.createComponent(CaminhoesComponent);
      fixture.detectChanges();
      const req = controle.expectOne('/api/caminhoes');
      expect(req.request.params.has('incluirExcluidos')).toBeFalse();
      req.flush([]);
    });

    it('oferece "Inativar" para ativo e "Reativar" para inativo', () => {
      const el: HTMLElement = criar().nativeElement;
      expect(el.querySelector('[data-placa="BCB8H89"] .acao-status')?.getAttribute('title')).toBe('Inativar');
      expect(el.querySelector('[data-placa="DEM1B22"] .acao-status')?.getAttribute('title')).toBe('Reativar');
    });

    it('inativar: confirma e faz PUT com todos os campos atuais e status INATIVO; depois recarrega', () => {
      const fixture = criar();
      const caminhao = SEM_EXCLUIDOS.find(c => c.placa === 'BCB8H89')!;
      (fixture.nativeElement.querySelector('[data-placa="BCB8H89"] .acao-status') as HTMLButtonElement).click();
      const [componente] = janelas.abrir.calls.mostRecent().args;
      expect(componente).toBe(ConfirmacaoComponent);
      const req = controle.expectOne(`/api/caminhoes/${caminhao.id}`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        placa: caminhao.placa, marca: caminhao.marca, modelo: caminhao.modelo, ano: caminhao.ano,
        eixos: caminhao.eixos, status: 'INATIVO', capacidadeTanqueLitros: caminhao.capacidadeTanqueLitros
      });
      req.flush({ ...caminhao, status: 'INATIVO' });
      controle.expectOne('/api/caminhoes').flush(SEM_EXCLUIDOS);
      expect(aviso.mostrar).toHaveBeenCalledWith('Caminhão BCB8H89 inativado.');
    });

    it('inativar com viagem em andamento (409): mostra a mensagem do servidor e recarrega', () => {
      const fixture = criar();
      const caminhao = SEM_EXCLUIDOS.find(c => c.placa === 'BCB8H89')!;
      (fixture.nativeElement.querySelector('[data-placa="BCB8H89"] .acao-status') as HTMLButtonElement).click();
      controle.expectOne(`/api/caminhoes/${caminhao.id}`).flush(
        { status: 409, erro: 'Conflito de dados', detalhes: ['O caminhão tem uma viagem em andamento e não pode ser inativado.'] },
        { status: 409, statusText: 'Conflict' });
      expect(aviso.falha).toHaveBeenCalled();
      controle.expectOne('/api/caminhoes').flush(SEM_EXCLUIDOS);
    });

    it('excluir: confirma (histórico preservado, sem volta) e faz DELETE', () => {
      const fixture = criar();
      const caminhao = SEM_EXCLUIDOS.find(c => c.placa === 'BCB8H89')!;
      (fixture.nativeElement.querySelector('[data-placa="BCB8H89"] .acao-excluir') as HTMLButtonElement).click();
      const [componente, dados] = janelas.abrir.calls.mostRecent().args as [unknown, DadosConfirmacao];
      expect(componente).toBe(ConfirmacaoComponent);
      expect(dados.perigo).toBeTrue();
      const texto = dados.paragrafos.join(' ');
      expect(texto).toContain('preservado');
      expect(texto).toContain('não pode ser desfeita');
      const req = controle.expectOne(`/api/caminhoes/${caminhao.id}`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });
      controle.expectOne('/api/caminhoes').flush([]);
    });

    it('excluir não confirmado não chama a API', () => {
      janelas.abrir.and.returnValue({ afterClosed: () => of(false) } as never);
      const fixture = criar();
      (fixture.nativeElement.querySelector('[data-placa="BCB8H89"] .acao-excluir') as HTMLButtonElement).click();
      controle.expectNone(r => r.method === 'DELETE');
    });

    it('caminhão antigo sem marca/eixos vai ao formulário para reativar (PUT exige os campos)', () => {
      const fixture = criar();
      (fixture.nativeElement.querySelector('[data-placa="DEM1B22"] .acao-status') as HTMLButtonElement).click();
      const [componente, dados] = janelas.abrir.calls.mostRecent().args as [unknown, { statusSugerido: string }];
      expect(componente).toBe(CaminhaoFormularioComponent);
      expect(dados.statusSugerido).toBe('ATIVO');
      // Formulário fechado com sucesso: a lista é recarregada.
      controle.expectOne('/api/caminhoes').flush(SEM_EXCLUIDOS);
    });
  });

  describe('perfil MOTORISTA', () => {
    beforeEach(() => entrarComo('MOTORISTA'));

    it('vê só o que o servidor devolve, sem cadastrar, editar, inativar ou excluir', () => {
      const fixture = criar(CAMINHOES_MOTORISTA_MOCK);
      const el: HTMLElement = fixture.nativeElement;
      expect(placas(fixture)).toEqual(CAMINHOES_MOTORISTA_MOCK.map(c => c.placa));
      expect(el.querySelector('.botao-cabecalho')).toBeNull();
      expect(el.querySelector('.acao-editar, .acao-status, .acao-excluir')).toBeNull();
      expect(el.querySelector('.acao-visualizar')).not.toBeNull();
      expect(el.textContent).not.toContain('Mostrar excluídos');
    });

    it('abre os dados do caminhão só para visualização', () => {
      janelas.abrir.and.returnValue({ afterClosed: () => of(undefined) } as never);
      const fixture = criar(CAMINHOES_MOTORISTA_MOCK);
      (fixture.nativeElement.querySelector('.acao-visualizar') as HTMLButtonElement).click();
      const [, dados] = janelas.abrir.calls.mostRecent().args as [unknown, { modo: string }];
      expect(dados.modo).toBe('visualizar');
    });
  });
});
