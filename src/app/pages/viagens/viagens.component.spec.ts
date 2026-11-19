import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ViagensModule } from './viagens.module';
import { ViagensComponent } from './viagens.component';
import { JanelasService } from '../../compartilhado/janela/janelas.service';
import { AberturaViagemComponent } from './abertura/abertura-viagem.component';
import { CAMINHOES_DONO_MOCK } from '../../../testes/dados/caminhoes.mock';
import { RESUMOS_DONO, RESUMOS_MOTORISTA, viagemEmAndamento } from '../../../testes/dados/viagens.mock';
import { entrarComo, limparSessao, todos } from '../../../testes/sessao-de-teste';
import { ViagemResumoResponse } from '../../core/modelos/api.modelos';

describe('ViagensComponent (lista)', () => {
  let controle: HttpTestingController;
  let janelas: jasmine.SpyObj<JanelasService>;

  beforeEach(() => {
    limparSessao();
    janelas = jasmine.createSpyObj<JanelasService>('JanelasService', ['abrir']);
    TestBed.configureTestingModule({
      imports: [ViagensModule],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: JanelasService, useValue: janelas }]
    });
    controle = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    controle.verify();
    limparSessao();
  });

  function criar(viagens: ViagemResumoResponse[]): ComponentFixture<ViagensComponent> {
    const fixture = TestBed.createComponent(ViagensComponent);
    fixture.detectChanges();
    controle.expectOne(r => r.url === '/api/viagens').flush(viagens);
    controle.expectOne(r => r.url === '/api/caminhoes').flush(CAMINHOES_DONO_MOCK);
    fixture.detectChanges();
    return fixture;
  }

  it('DONO vê lucro e margem; nulo aparece como "não calculado" (nunca R$ 0,00)', () => {
    entrarComo('DONO');
    const el: HTMLElement = criar(RESUMOS_DONO).nativeElement;
    expect(todos(el, 'th.coluna-financeira').map(t => t.textContent?.trim())).toEqual(['Lucro', 'Margem']);
    const andamento = el.querySelector('tr[data-viagem-id="206"]') as HTMLElement;
    expect(andamento.textContent).toContain('não calculado');
    expect(andamento.textContent).not.toContain('R$ 0,00');
    expect(el.querySelector('tr[data-viagem-id="205"]')!.textContent).toContain('56,99%');
  });

  it('MOTORISTA não vê colunas financeiras nem "Viagem histórica", mas vê o valor do frete', () => {
    entrarComo('MOTORISTA');
    const el: HTMLElement = criar(RESUMOS_MOTORISTA).nativeElement;
    expect(el.querySelector('.botao-historica')).toBeNull();
    expect(el.querySelector('.coluna-financeira')).toBeNull();
    expect(el.textContent).not.toContain('Lucro');
    expect(el.querySelector('tr[data-viagem-id="205"]')!.textContent).toContain('3.500,00');
  });

  it('destaca a viagem em andamento com atalho para o detalhe', () => {
    entrarComo('MOTORISTA');
    const el: HTMLElement = criar(RESUMOS_MOTORISTA).nativeElement;
    expect(el.querySelector('.cartao-andamento')?.getAttribute('href')).toBe('/viagens/206');
  });

  it('filtros de status e caminhão vão para o servidor', () => {
    entrarComo('DONO');
    const fixture = criar(RESUMOS_DONO);
    fixture.componentInstance.filtrarStatus('CANCELADA');
    let req = controle.expectOne(r => r.url === '/api/viagens');
    expect(req.request.params.get('status')).toBe('CANCELADA');
    req.flush([]);
    fixture.componentInstance.filtrarCaminhao('1');
    req = controle.expectOne(r => r.url === '/api/viagens');
    expect(req.request.params.get('status')).toBe('CANCELADA');
    expect(req.request.params.get('caminhaoId')).toBe('1');
    req.flush([]);
    fixture.detectChanges();
    expect(fixture.componentInstance.estado()).toBe('vazio');
  });

  it('falha da lista mostra erro com "Tentar de novo"', () => {
    entrarComo('DONO');
    const fixture = TestBed.createComponent(ViagensComponent);
    fixture.detectChanges();
    controle.expectOne('/api/viagens').flush({ status: 500, erro: 'Erro interno', detalhes: ['x'] }, { status: 500, statusText: 'Error' });
    controle.expectOne('/api/caminhoes').flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.estado-falha')).not.toBeNull();
  });

  it('nova viagem abre a janela de abertura e, aberta, navega para o detalhe', () => {
    entrarComo('MOTORISTA');
    janelas.abrir.and.returnValue({ afterClosed: () => of(viagemEmAndamento({ id: 300 })) } as never);
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    const fixture = criar([]);
    (fixture.nativeElement.querySelector('.botao-cabecalho') as HTMLButtonElement).click();
    expect(janelas.abrir.calls.mostRecent().args[0]).toBe(AberturaViagemComponent);
    expect(router.navigate).toHaveBeenCalledWith(['/viagens', 300]);
  });
});
