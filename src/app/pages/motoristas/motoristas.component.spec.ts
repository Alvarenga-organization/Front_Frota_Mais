import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { CAMINHOES_DONO_MOCK } from '../../../testes/dados/caminhoes.mock';
import { MOTORISTAS_MOCK } from '../../../testes/dados/motoristas.mock';
import { MotoristasModule } from './motoristas.module';
import { MotoristasComponent } from './motoristas.component';
import { JanelasService } from '../../compartilhado/janela/janelas.service';
import { AvisoService } from '../../compartilhado/aviso.service';
import { DadosConfirmacao } from '../../compartilhado/confirmacao/confirmacao.component';
import { entrarComo, limparSessao, todos } from '../../../testes/sessao-de-teste';

describe('MotoristasComponent', () => {
  let janelas: jasmine.SpyObj<JanelasService>;
  let aviso: jasmine.SpyObj<AvisoService>;
  let fixture: ComponentFixture<MotoristasComponent>;
  let el: HTMLElement;
  let controle: HttpTestingController;

  function responderCarga(motoristas = MOTORISTAS_MOCK): void {
    controle.expectOne('/api/motoristas').flush(motoristas);
    const caminhoes = controle.expectOne(r => r.url === '/api/caminhoes');
    expect(caminhoes.request.params.get('incluirExcluidos')).toBe('true');
    caminhoes.flush(CAMINHOES_DONO_MOCK);
  }

  beforeEach(async () => {
    limparSessao();
    janelas = jasmine.createSpyObj<JanelasService>('JanelasService', ['abrir']);
    janelas.abrir.and.returnValue({ afterClosed: () => of(true) } as never);
    aviso = jasmine.createSpyObj<AvisoService>('AvisoService', ['falha', 'mostrar']);
    await TestBed.configureTestingModule({
      imports: [MotoristasModule],
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: JanelasService, useValue: janelas },
        { provide: AvisoService, useValue: aviso }
      ]
    }).compileComponents();
    entrarComo('DONO');
    controle = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MotoristasComponent);
    fixture.detectChanges();
    responderCarga();
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  afterEach(() => {
    controle.verify();
    limparSessao();
  });

  function linha(id: number): HTMLElement {
    return el.querySelector(`[data-motorista-id="${id}"]`) as HTMLElement;
  }

  it('exibe a situação de cada motorista com rótulo legível', () => {
    expect(linha(31).querySelector('.selo')?.textContent?.trim()).toBe('Ativo');
    expect(linha(33).querySelector('.selo')?.textContent?.trim()).toBe('Convite pendente');
    expect(linha(32).querySelector('.selo')?.textContent?.trim()).toBe('Inativo');
  });

  it('mostra as placas vinculadas e sinaliza caminhão excluído', () => {
    expect(linha(31).textContent).toContain('BCB8H89');
    expect(linha(32).textContent).toContain('DEM0A01 (excluído)');
    expect(linha(34).textContent).toContain('Nenhum');
  });

  it('mostra ações de convite só para conta com convite pendente', () => {
    expect(linha(31).querySelector('.acao-reenviar')).toBeNull();
    expect(linha(32).querySelector('.acao-reenviar')).toBeNull();
    expect(linha(31).querySelector('.acao-cancelar-convite')).toBeNull();
    expect(linha(33).querySelector('.acao-reenviar')).not.toBeNull();
    expect(linha(33).querySelector('.acao-cancelar-convite')).not.toBeNull();
  });

  it('convite expirado ou cancelado: permite reenviar, mas não cancelar', () => {
    expect(linha(34).textContent).toContain('Expirado ou cancelado');
    expect(linha(34).querySelector('.acao-reenviar')).not.toBeNull();
    expect(linha(34).querySelector('.acao-cancelar-convite')).toBeNull();
  });

  it('exibe a validade do convite pendente no horário de Brasília', () => {
    // 2026-11-14T15:00:00Z = 14/11/2026 12:00 em Brasília.
    expect(linha(33).textContent).toContain('Válido até 14/11/2026 12:00');
  });

  it('cancelar convite pede confirmação, faz DELETE .../convite e recarrega', () => {
    (linha(33).querySelector('.acao-cancelar-convite') as HTMLButtonElement).click();
    const [, dados] = janelas.abrir.calls.mostRecent().args as [unknown, DadosConfirmacao];
    expect(dados.titulo).toContain('Cancelar o convite');
    expect(dados.perigo).toBeTrue();
    const req = controle.expectOne('/api/motoristas/33/convite');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    expect(aviso.mostrar).toHaveBeenCalledWith('Convite de João Pereira cancelado.');
    responderCarga();
  });

  it('reenviar convite faz POST .../convite sem corpo', () => {
    (linha(34).querySelector('.acao-reenviar') as HTMLButtonElement).click();
    const req = controle.expectOne('/api/motoristas/34/convite');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    req.flush({});
    responderCarga();
  });

  it('reenviar sem e-mail configurado (503): mostra a falha e recarrega (nada foi gravado)', () => {
    (linha(34).querySelector('.acao-reenviar') as HTMLButtonElement).click();
    controle.expectOne('/api/motoristas/34/convite').flush(
      { status: 503, erro: 'Serviço indisponível', detalhes: ['Envio de e-mail não configurado.'] },
      { status: 503, statusText: 'Service Unavailable' });
    expect(aviso.falha).toHaveBeenCalled();
    expect(aviso.mostrar).not.toHaveBeenCalled();
    responderCarga();
  });

  it('403 na carga (perfil mudou no servidor) mostra falha, sem dados', () => {
    fixture.componentInstance.carregar();
    controle.expectOne('/api/motoristas').flush(
      { status: 403, erro: 'Acesso negado', detalhes: ['Acesso negado.'] }, { status: 403, statusText: 'Forbidden' });
    // A outra consulta da carga é cancelada (forkJoin): nenhum dado parcial é exibido.
    controle.match(r => r.url === '/api/caminhoes').forEach(r => expect(r.cancelled).toBeTrue());
    fixture.detectChanges();
    expect(fixture.componentInstance.estado()).toBe('falha');
    expect(el.querySelector('[data-motorista-id]')).toBeNull();
  });

  it('lista vazia não é erro', () => {
    fixture.componentInstance.carregar();
    responderCarga([]);
    fixture.detectChanges();
    expect(fixture.componentInstance.estado()).toBe('vazio');
  });

  it('filtra localmente por situação', () => {
    fixture.componentInstance.filtroSituacao.set('CONVITE_PENDENTE');
    fixture.detectChanges();
    const ids = todos(el, '[data-motorista-id]').map(e => e.getAttribute('data-motorista-id'));
    expect(ids).toEqual(['34', '33']);
  });
});
