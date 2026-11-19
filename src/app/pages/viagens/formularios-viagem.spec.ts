import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Type } from '@angular/core';
import { ViagensModule } from './viagens.module';
import { AberturaViagemComponent } from './abertura/abertura-viagem.component';
import { FinalizacaoViagemComponent } from './finalizacao/finalizacao-viagem.component';
import { CancelamentoViagemComponent } from './cancelamento/cancelamento-viagem.component';
import { LancamentoFormularioComponent } from './lancamento/lancamento-formulario.component';
import { EdicaoViagemComponent } from './edicao/edicao-viagem.component';
import { AvisoService } from '../../compartilhado/aviso.service';
import { CAMINHOES_DONO_MOCK } from '../../../testes/dados/caminhoes.mock';
import { MOTORISTAS_MOCK } from '../../../testes/dados/motoristas.mock';
import { viagemEmAndamento, viagemFinalizada } from '../../../testes/dados/viagens.mock';
import { entrarComo, limparSessao } from '../../../testes/sessao-de-teste';
import { Perfil } from '../../core/modelos/api.modelos';

describe('Formulários de viagem', () => {
  let controle: HttpTestingController;
  let fechar: jasmine.Spy;

  function criar<T>(componente: Type<T>, dados: unknown, perfil: Perfil = 'DONO') {
    limparSessao();
    fechar = jasmine.createSpy('close');
    TestBed.configureTestingModule({
      imports: [ViagensModule],
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: dados },
        { provide: MatDialogRef, useValue: { close: fechar } },
        { provide: AvisoService, useValue: jasmine.createSpyObj('AvisoService', ['mostrar', 'falha']) }
      ]
    });
    controle = TestBed.inject(HttpTestingController);
    entrarComo(perfil);
    const fixture = TestBed.createComponent(componente);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    controle.verify();
    limparSessao();
  });

  describe('Abertura', () => {
    it('oferece só caminhões ATIVOS e o DONO escolhe entre motoristas ativos vinculados', () => {
      const fixture = criar(AberturaViagemComponent, { caminhoes: CAMINHOES_DONO_MOCK });
      controle.expectOne('/api/motoristas').flush(MOTORISTAS_MOCK);
      const c = fixture.componentInstance;
      expect(c.caminhoes.every(cam => cam.status === 'ATIVO')).toBeTrue();
      c.formulario.controls.caminhaoId.setValue('1');
      expect(c.opcoesResponsavel().map(o => o.rotulo)).toEqual(['Ninguém', 'Eu mesmo', 'Carlos Lima']);
    });

    it('sai vazio: envia kmInicialVazio, consumo vazio e abastecimentos anteriores no mesmo POST', () => {
      const fixture = criar(AberturaViagemComponent, { caminhoes: CAMINHOES_DONO_MOCK });
      controle.expectOne('/api/motoristas').flush(MOTORISTAS_MOCK);
      const c = fixture.componentInstance;
      c.formulario.patchValue({ caminhaoId: '1', responsavel: '31', dataInicio: '2025-03-05', saida: 'VAZIO', km: '10400',
        origem: ' São Paulo ', valorFrete: '3.500,00', consumoMedioVazio: '3,20' });
      c.adicionarAbastecimento();
      c.abastecimentos.at(0).patchValue({ data: '2025-03-04', hora: '18:30', litros: '100', valorTotal: '640,00' });
      c.abrir();
      const req = controle.expectOne('/api/viagens');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        caminhaoId: 1, motoristaId: 31, dataInicio: '2025-03-05', origem: 'São Paulo', destino: null, valorFrete: '3500.00',
        kmInicialVazio: 10400, kmInicialCarregado: null, consumoMedioVazio: '3.20', consumoMedioCarregado: null,
        abastecimentos: [{ tipo: 'DIESEL', data: '2025-03-04', hora: '18:30', litros: '100', valorTotal: '640.00' }]
      });
      const aberta = viagemEmAndamento();
      req.flush(aberta, { status: 201, statusText: 'Created' });
      expect(fechar).toHaveBeenCalledWith(aberta);
    });

    it('MOTORISTA: não busca motoristas, não escolhe responsável e não envia consumo vazio quando sai carregado', () => {
      const fixture = criar(AberturaViagemComponent, { caminhoes: CAMINHOES_DONO_MOCK }, 'MOTORISTA');
      controle.expectNone('/api/motoristas');
      expect(fixture.nativeElement.querySelector('#abertura-responsavel')).toBeNull();
      const c = fixture.componentInstance;
      c.formulario.patchValue({ caminhaoId: '1', saida: 'CARREGADO', km: '500', consumoMedioVazio: '3,00' });
      c.abrir();
      const req = controle.expectOne('/api/viagens');
      expect(req.request.body.motoristaId).toBeNull();
      expect(req.request.body.kmInicialCarregado).toBe(500);
      expect(req.request.body.kmInicialVazio).toBeNull();
      expect(req.request.body.consumoMedioVazio).toBeNull();
      req.flush(viagemEmAndamento());
    });

    it('sem km inicial não envia; 409 do servidor fica visível e a janela continua aberta', () => {
      const fixture = criar(AberturaViagemComponent, { caminhoes: CAMINHOES_DONO_MOCK }, 'MOTORISTA');
      const c = fixture.componentInstance;
      c.formulario.patchValue({ caminhaoId: '1', saida: 'VAZIO' });
      c.abrir();
      controle.expectNone('/api/viagens');
      c.formulario.patchValue({ km: '100' });
      c.abrir();
      c.abrir();
      controle.expectOne('/api/viagens').flush(
        { status: 409, erro: 'Conflito de dados', detalhes: ['O caminhão já tem uma viagem em andamento.'] }, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('O caminhão já tem uma viagem em andamento.');
      expect(fechar).not.toHaveBeenCalled();
    });
  });

  describe('Finalização', () => {
    it('sem dados faltando: só POST .../finalizar com data, km e consumos', () => {
      const viagem = viagemEmAndamento({ destino: 'Palmital', valorFrete: 3500, kmInicialCarregado: 10480, consumoMedioCarregado: 2.5 });
      const fixture = criar(FinalizacaoViagemComponent, { viagem });
      const c = fixture.componentInstance;
      expect(c.coletaFaltas).toBeFalse();
      c.formulario.patchValue({ dataFim: '2025-03-07', kmFinalCarregado: '10980' });
      c.finalizar();
      const req = controle.expectOne('/api/viagens/205/finalizar');
      expect(req.request.body).toEqual({ dataFim: '2025-03-07', kmFinalCarregado: 10980, consumoMedioVazio: '3.2', consumoMedioCarregado: '2.5' });
      req.flush(viagemFinalizada());
      expect(fechar).toHaveBeenCalled();
    });

    it('faltando frete, destino e carregamento: PUT integral (com motoristaId do DONO) e depois finaliza', () => {
      const fixture = criar(FinalizacaoViagemComponent, { viagem: viagemEmAndamento() });
      const c = fixture.componentInstance;
      c.formulario.patchValue({ dataFim: '2025-03-07', kmFinalCarregado: '10980', consumoMedioCarregado: '2,50',
        valorFrete: '3500', destino: 'Palmital', kmInicialCarregado: '10480' });
      c.finalizar();
      const put = controle.expectOne('/api/viagens/205');
      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toEqual(jasmine.objectContaining({ valorFrete: '3500', destino: 'Palmital', kmInicialCarregado: 10480,
        origem: 'São Paulo', motoristaId: 31, dataFim: null, kmFinalCarregado: null }));
      controle.expectNone('/api/viagens/205/finalizar');
      put.flush(viagemEmAndamento());
      controle.expectOne('/api/viagens/205/finalizar').flush(viagemFinalizada());
    });

    it('PUT gravado mas finalização recusada (400): avisa e mostra a lista do servidor', () => {
      const fixture = criar(FinalizacaoViagemComponent, { viagem: viagemEmAndamento() }, 'MOTORISTA');
      const c = fixture.componentInstance;
      c.formulario.patchValue({ kmFinalCarregado: '10980', consumoMedioCarregado: '2,50', valorFrete: '3500', destino: 'X', kmInicialCarregado: '10480' });
      c.finalizar();
      const put = controle.expectOne('/api/viagens/205');
      expect('motoristaId' in put.request.body).toBeFalse();
      put.flush(viagemEmAndamento());
      controle.expectOne('/api/viagens/205/finalizar').flush(
        { status: 400, erro: 'Dados inválidos', detalhes: ['Há lançamento depois da data final.'] }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      const texto = fixture.nativeElement.textContent;
      expect(texto).toContain('foram salvos, mas a viagem não foi finalizada');
      expect(texto).toContain('Há lançamento depois da data final.');
      expect(fechar).not.toHaveBeenCalled();
      // Nova tentativa não repete o PUT já gravado.
      c.finalizar();
      controle.expectNone('/api/viagens/205');
      controle.expectOne('/api/viagens/205/finalizar').flush(viagemFinalizada());
    });
  });

  describe('Cancelamento', () => {
    it('motivo é obrigatório; envia motivo, data e opcionais nulos', () => {
      const fixture = criar(CancelamentoViagemComponent, { viagem: viagemEmAndamento() });
      const c = fixture.componentInstance;
      c.formulario.patchValue({ motivo: '   ' });
      c.cancelar();
      controle.expectNone('/api/viagens/205/cancelar');
      c.formulario.patchValue({ motivo: ' Carga recusada pelo cliente ', dataFim: '2025-03-06', consumoMedioVazio: '' });
      c.cancelar();
      const req = controle.expectOne('/api/viagens/205/cancelar');
      expect(req.request.body).toEqual({ motivo: 'Carga recusada pelo cliente', dataFim: '2025-03-06', kmFinalCarregado: null,
        consumoMedioVazio: null, consumoMedioCarregado: null });
      req.flush(viagemEmAndamento({ status: 'CANCELADA' }));
      expect(fechar).toHaveBeenCalled();
    });
  });

  describe('Lançamentos', () => {
    it('despesa extra com descrição livre (sem bloqueio de palavras) e valor convertido', () => {
      const fixture = criar(LancamentoFormularioComponent, { viagem: viagemEmAndamento(), tipo: 'despesas-extras' }, 'MOTORISTA');
      const c = fixture.componentInstance;
      c.despesa.patchValue({ descricao: 'Almoço e bebida', data: '2025-03-06', valor: '35,00' });
      c.salvar();
      const req = controle.expectOne('/api/viagens/205/despesas-extras');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ descricao: 'Almoço e bebida', data: '2025-03-06', valor: '35.00' });
      req.flush({ id: 1, descricao: 'Almoço e bebida', data: '2025-03-06', valor: 35 }, { status: 201, statusText: 'Created' });
      expect(fechar).toHaveBeenCalledWith(true);
    });

    it('corrige abastecimento com PUT integral pré-preenchido', () => {
      const viagem = viagemEmAndamento();
      const fixture = criar(LancamentoFormularioComponent, { viagem, tipo: 'abastecimentos', atual: viagem.abastecimentosDiesel[0] });
      const c = fixture.componentInstance;
      c.abastecimento.patchValue({ valorTotal: '1.553,10' });
      c.salvar();
      const req = controle.expectOne('/api/viagens/205/abastecimentos/901');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ tipo: 'DIESEL', data: '2025-03-04', hora: '18:30', litros: '100', valorTotal: '1553.10' });
      req.flush(viagem.abastecimentosDiesel[0]);
    });

    it('preço do diesel implausível (400): mostra a mensagem do servidor', () => {
      const fixture = criar(LancamentoFormularioComponent, { viagem: viagemEmAndamento(), tipo: 'abastecimentos', combustivel: 'DIESEL' });
      const c = fixture.componentInstance;
      c.abastecimento.patchValue({ data: '2025-03-06', litros: '1500', valorTotal: '250' });
      c.salvar();
      controle.expectOne('/api/viagens/205/abastecimentos').flush(
        { status: 400, erro: 'Dados inválidos', detalhes: ['Preço por litro fora do esperado. Confira se litros e valor não foram trocados.'] },
        { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('litros e valor não foram trocados');
    });
  });

  describe('Edição/correção', () => {
    it('correção de finalizada pelo DONO avisa da auditoria e envia dataFim e km final', () => {
      const fixture = criar(EdicaoViagemComponent, { viagem: viagemFinalizada(), motoristas: MOTORISTAS_MOCK });
      expect(fixture.nativeElement.textContent).toContain('auditoria');
      const c = fixture.componentInstance;
      c.formulario.patchValue({ valorFrete: '3.700,00' });
      c.salvar();
      const req = controle.expectOne('/api/viagens/205');
      expect(req.request.body).toEqual(jasmine.objectContaining({ valorFrete: '3700.00', dataFim: '2025-03-07', kmFinalCarregado: 10980, motoristaId: 31 }));
      req.flush(viagemFinalizada({ valorFrete: 3700 }));
    });

    it('DONO pode retirar o responsável explicitamente ("Ninguém" → motoristaId null)', () => {
      const fixture = criar(EdicaoViagemComponent, { viagem: viagemEmAndamento(), motoristas: MOTORISTAS_MOCK });
      const c = fixture.componentInstance;
      c.formulario.patchValue({ responsavel: '' });
      c.salvar();
      const req = controle.expectOne('/api/viagens/205');
      expect(req.request.body.motoristaId).toBeNull();
      req.flush(viagemEmAndamento({ motoristaId: null, motoristaNome: null }));
    });
  });
});
