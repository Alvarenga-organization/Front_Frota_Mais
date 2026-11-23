import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ViagensService } from './viagens.service';
import { LancamentosService } from './lancamentos.service';
import { RESUMOS_MOTORISTA, viagemEmAndamento, viagemFinalizada } from '../../../testes/dados/viagens.mock';
import { ViagemResponse, ViagemResumoResponse } from '../modelos/api.modelos';

describe('ViagensService e LancamentosService', () => {
  let controle: HttpTestingController;
  let viagens: ViagensService;
  let lancamentos: LancamentosService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    controle = TestBed.inject(HttpTestingController);
    viagens = TestBed.inject(ViagensService);
    lancamentos = TestBed.inject(LancamentosService);
  });

  afterEach(() => controle.verify());

  it('listar: GET /api/viagens só com os filtros informados (status, caminhaoId)', () => {
    viagens.listar().subscribe();
    expect(controle.expectOne(r => r.url === '/api/viagens').request.params.keys()).toEqual([]);
    viagens.listar({ status: 'FINALIZADA', caminhaoId: 12 }).subscribe();
    const req = controle.expectOne(r => r.url === '/api/viagens');
    expect(req.request.params.get('status')).toBe('FINALIZADA');
    expect(req.request.params.get('caminhaoId')).toBe('12');
    req.flush([]);
  });

  it('visão do MOTORISTA: campos financeiros nulos chegam nulos (não viram zero)', () => {
    let recebido: ViagemResumoResponse[] = [];
    viagens.listar().subscribe(l => (recebido = l));
    controle.expectOne('/api/viagens').flush(RESUMOS_MOTORISTA);
    expect(recebido[1].lucro).toBeNull();
    expect(recebido[1].margemPercentual).toBeNull();
    expect(recebido[1].valorFrete).toBe(3500);
  });

  it('obter: rentabilidade nula para o MOTORISTA é preservada', () => {
    let recebido: ViagemResponse | null = null;
    viagens.obter(205).subscribe(v => (recebido = v));
    controle.expectOne('/api/viagens/205').flush(viagemFinalizada({ rentabilidade: null }));
    expect(recebido!.rentabilidade).toBeNull();
  });

  it('cobre abertura, alteração, finalização, cancelamento, histórica e auditoria', () => {
    viagens.abrir({ caminhaoId: 1, motoristaId: null, dataInicio: '2025-03-05', origem: null, destino: null, valorFrete: null,
      kmInicialVazio: 10400, kmInicialCarregado: null, consumoMedioVazio: null, consumoMedioCarregado: null, abastecimentos: null }).subscribe();
    viagens.atualizar(205, { dataInicio: '2025-03-05', origem: 'A', destino: 'B', valorFrete: '3500.00', kmInicialVazio: 1,
      kmInicialCarregado: 2, consumoMedioVazio: null, consumoMedioCarregado: null, dataFim: null, kmFinalCarregado: null }).subscribe();
    viagens.finalizar(205, { dataFim: '2025-03-07', kmFinalCarregado: 10980, consumoMedioVazio: '3.20', consumoMedioCarregado: '2.50' }).subscribe();
    viagens.cancelar(205, { motivo: 'Carga recusada', dataFim: null, kmFinalCarregado: null, consumoMedioVazio: null, consumoMedioCarregado: null }).subscribe();
    viagens.registrarHistorica({ caminhaoId: 1, motoristaId: null, dataInicio: '2025-02-10', dataFim: '2025-02-12', origem: 'A',
      destino: 'B', valorFrete: '2800.00', kmInicialVazio: null, kmInicialCarregado: 1, kmFinalCarregado: 2, consumoMedioVazio: null,
      consumoMedioCarregado: '2.40', abastecimentos: null, pedagios: null, despesasExtras: null }).subscribe();
    viagens.alteracoes(205).subscribe();
    viagens.fotografiasAnteriores(205).subscribe();
    const reqs = controle.match(() => true);
    expect(reqs.map(r => `${r.request.method} ${r.request.url}`)).toEqual([
      'POST /api/viagens',
      'PUT /api/viagens/205',
      'POST /api/viagens/205/finalizar',
      'POST /api/viagens/205/cancelar',
      'POST /api/viagens/historicas',
      'GET /api/viagens/205/alteracoes',
      'GET /api/viagens/205/fotografias-anteriores'
    ]);
    // PUT do MOTORISTA: sem motoristaId no corpo (ausente mantém o responsável).
    expect('motoristaId' in reqs[1].request.body).toBeFalse();
    reqs.forEach(r => r.flush(r.request.method === 'GET' ? [] : viagemEmAndamento()));
  });

  it('lançamentos: POST, PUT e DELETE nas rotas de cada tipo', () => {
    lancamentos.criar(205, 'abastecimentos', { tipo: 'ARLA', data: '2025-03-06', hora: null, litros: '20', valorTotal: '80.00' }).subscribe();
    lancamentos.atualizar(205, 'pedagios', 950, { data: '2025-03-06', valor: '40.10' }).subscribe();
    lancamentos.excluir(205, 'despesas-extras', 960).subscribe();
    const reqs = controle.match(() => true);
    expect(reqs.map(r => `${r.request.method} ${r.request.url}`)).toEqual([
      'POST /api/viagens/205/abastecimentos',
      'PUT /api/viagens/205/pedagios/950',
      'DELETE /api/viagens/205/despesas-extras/960'
    ]);
    expect(reqs[0].request.body.valorTotal).toBe('80.00');
    reqs[0].flush({ id: 1, tipo: 'ARLA', data: '2025-03-06', hora: null, litros: 20, valorTotal: 80 });
    reqs[1].flush({ id: 950, data: '2025-03-06', valor: 40.1 });
    reqs[2].flush(null, { status: 204, statusText: 'No Content' });
  });

  it('lançamento em viagem finalizada (409) é repassado como erro', () => {
    let status = 0;
    lancamentos.criar(205, 'pedagios', { data: '2025-03-06', valor: '10.00' }).subscribe({ error: e => (status = e.status) });
    controle.expectOne('/api/viagens/205/pedagios').flush(
      { status: 409, erro: 'Conflito de dados', detalhes: ['Viagem finalizada não recebe lançamentos.'] }, { status: 409, statusText: 'Conflict' });
    expect(status).toBe(409);
  });
});
