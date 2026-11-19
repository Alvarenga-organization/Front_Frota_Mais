import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ViagensModule } from '../viagens.module';
import { ViagemDetalheComponent } from './viagem-detalhe.component';
import { JanelasService } from '../../../compartilhado/janela/janelas.service';
import { AvisoService } from '../../../compartilhado/aviso.service';
import { ViagemResponse } from '../../../core/modelos/api.modelos';
import { viagemEmAndamento, viagemFinalizada } from '../../../../testes/dados/viagens.mock';
import { entrarComo, limparSessao } from '../../../../testes/sessao-de-teste';

describe('ViagemDetalheComponent', () => {
  let controle: HttpTestingController;
  let janelas: jasmine.SpyObj<JanelasService>;

  beforeEach(() => {
    limparSessao();
    janelas = jasmine.createSpyObj<JanelasService>('JanelasService', ['abrir']);
    janelas.abrir.and.returnValue({ afterClosed: () => of(true) } as never);
    TestBed.configureTestingModule({
      imports: [ViagensModule],
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '205' }) } } },
        { provide: JanelasService, useValue: janelas },
        { provide: AvisoService, useValue: jasmine.createSpyObj('AvisoService', ['mostrar', 'falha']) }
      ]
    });
    controle = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    controle.verify();
    limparSessao();
  });

  function criar(viagem: ViagemResponse): ComponentFixture<ViagemDetalheComponent> {
    const fixture = TestBed.createComponent(ViagemDetalheComponent);
    fixture.detectChanges();
    controle.expectOne('/api/viagens/205').flush(viagem);
    fixture.detectChanges();
    return fixture;
  }

  it('DONO: resultado com nulos como "não calculado" e as pendências do servidor sem reescrever', () => {
    entrarComo('DONO');
    const el: HTMLElement = criar(viagemEmAndamento()).nativeElement;
    const resultado = el.querySelector('.cartao-resultado') as HTMLElement;
    expect(resultado.textContent).toContain('Cálculo ao vivo');
    expect(resultado.textContent).toContain('não calculado');
    expect(resultado.textContent).toContain('Valor do frete não informado.');
    expect(resultado.textContent).toContain('Km do carregamento não informado.');
    expect(el.querySelector('.acao-cancelar')).not.toBeNull();
  });

  it('DONO em viagem finalizada: fotografia gravada, corrigir sim, finalizar/incluir/excluir não', () => {
    entrarComo('DONO');
    const el: HTMLElement = criar(viagemFinalizada()).nativeElement;
    expect(el.querySelector('.cartao-resultado')!.textContent).toContain('Resultado gravado em');
    expect(el.querySelector('.acao-corrigir')).not.toBeNull();
    expect(el.querySelector('.acao-finalizar, .acao-cancelar, .acao-excluir-lancamento')).toBeNull();
    expect(el.textContent).not.toContain('+ Diesel');
    expect(el.querySelector('.acao-corrigir-lancamento')).not.toBeNull();
  });

  it('MOTORISTA: sem resultado financeiro, sem cancelar e sem auditoria (rentabilidade vem nula)', () => {
    entrarComo('MOTORISTA');
    const el: HTMLElement = criar(viagemEmAndamento({ rentabilidade: null })).nativeElement;
    expect(el.querySelector('.cartao-resultado')).toBeNull();
    expect(el.textContent).not.toContain('Lucro');
    expect(el.querySelector('.acao-cancelar')).toBeNull();
    expect(el.textContent).not.toContain('Histórico de alterações');
    expect(el.querySelector('.acao-finalizar')).not.toBeNull();
    expect(el.textContent).toContain('+ Pedágio');
  });

  it('MOTORISTA em viagem finalizada só visualiza', () => {
    entrarComo('MOTORISTA');
    const el: HTMLElement = criar(viagemFinalizada({ rentabilidade: null })).nativeElement;
    expect(el.querySelector('.barra-acoes button')).toBeNull();
    expect(el.querySelector('.acao-corrigir-lancamento, .acao-excluir-lancamento')).toBeNull();
  });

  it('404 mostra "não encontrada" sem sugerir que a viagem existe', () => {
    entrarComo('MOTORISTA');
    const fixture = TestBed.createComponent(ViagemDetalheComponent);
    fixture.detectChanges();
    controle.expectOne('/api/viagens/205').flush({ status: 404, erro: 'Não encontrado', detalhes: ['Viagem não encontrada.'] },
      { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Viagem não encontrada');
    expect(fixture.nativeElement.querySelector('.barra-acoes')).toBeNull();
  });

  it('excluir lançamento: confirma, DELETE e recarrega o detalhe (a resposta não traz a rentabilidade)', () => {
    entrarComo('MOTORISTA');
    const fixture = criar(viagemEmAndamento({ rentabilidade: null }));
    (fixture.nativeElement.querySelector('[data-lancamento="pedagio-950"] .acao-excluir-lancamento') as HTMLButtonElement).click();
    const req = controle.expectOne('/api/viagens/205/pedagios/950');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    controle.expectOne('/api/viagens/205').flush(viagemEmAndamento({ pedagios: [], rentabilidade: null }));
  });

  it('novo lançamento salvo recarrega o detalhe', () => {
    entrarComo('MOTORISTA');
    const fixture = criar(viagemEmAndamento({ rentabilidade: null }));
    fixture.componentInstance.novoLancamento('pedagios');
    controle.expectOne('/api/viagens/205').flush(viagemEmAndamento({ rentabilidade: null }));
  });

  it('DONO abre a auditoria: alterações campo a campo com rótulos', () => {
    entrarComo('DONO');
    const fixture = criar(viagemFinalizada());
    fixture.componentInstance.alternarAuditoria();
    controle.expectOne('/api/viagens/205/alteracoes').flush([{ id: 77, alteradaEm: '2025-03-10T12:00:00Z', usuarioId: 1,
      usuarioNome: 'Ana Souza', perfil: 'DONO', entidade: 'VIAGEM', registroId: 205, campo: 'valorFrete',
      valorAnterior: '3500.00', valorNovo: '3700.00' }]);
    controle.expectOne('/api/viagens/205/fotografias-anteriores').flush([]);
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Valor do frete');
    expect(texto).toContain('3500.00');
    expect(texto).toContain('Ana Souza');
  });

  it('editar (DONO) busca motoristas e abre o formulário; salvo, recarrega', () => {
    entrarComo('DONO');
    const fixture = criar(viagemEmAndamento());
    (fixture.nativeElement.querySelector('.acao-editar-viagem') as HTMLButtonElement).click();
    controle.expectOne('/api/motoristas').flush([]);
    expect(janelas.abrir).toHaveBeenCalled();
    controle.expectOne('/api/viagens/205').flush(viagemEmAndamento());
  });
});
