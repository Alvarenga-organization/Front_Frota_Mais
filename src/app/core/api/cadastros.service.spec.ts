import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CaminhoesService } from './caminhoes.service';
import { MotoristasService } from './motoristas.service';
import { CAMINHOES_DONO_MOCK } from '../../../testes/dados/caminhoes.mock';
import { MOTORISTAS_MOCK } from '../../../testes/dados/motoristas.mock';

describe('CaminhoesService e MotoristasService', () => {
  let controle: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    controle = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controle.verify());

  describe('CaminhoesService', () => {
    it('listar: GET /api/caminhoes, com incluirExcluidos=true só quando pedido', () => {
      const servico = TestBed.inject(CaminhoesService);
      let recebido: unknown;
      servico.listar().subscribe(l => (recebido = l));
      const padrao = controle.expectOne(r => r.url === '/api/caminhoes');
      expect(padrao.request.params.keys()).toEqual([]);
      padrao.flush(CAMINHOES_DONO_MOCK);
      expect(recebido).toEqual(CAMINHOES_DONO_MOCK);
      servico.listar(true).subscribe();
      expect(controle.expectOne(r => r.url === '/api/caminhoes').request.params.get('incluirExcluidos')).toBe('true');
    });

    it('preserva campos nulos (marca/eixos de cadastros antigos)', () => {
      let recebido: unknown;
      TestBed.inject(CaminhoesService).obter(4).subscribe(c => (recebido = c));
      const antigo = { ...CAMINHOES_DONO_MOCK[0], marca: null, eixos: null, capacidadeTanqueLitros: null };
      controle.expectOne('/api/caminhoes/4').flush(antigo);
      expect(recebido).toEqual(antigo);
    });

    it('criar/atualizar/excluir usam POST, PUT e DELETE na rota certa', () => {
      const servico = TestBed.inject(CaminhoesService);
      const corpo = { placa: 'ABC1D23', marca: 'Volvo', modelo: 'FH', ano: 2022, eixos: 6, status: 'ATIVO' as const, capacidadeTanqueLitros: null };
      servico.criar(corpo).subscribe();
      servico.atualizar(9, corpo).subscribe();
      servico.excluir(9).subscribe();
      const [post, put, del] = [controle.expectOne(r => r.method === 'POST'), controle.expectOne(r => r.method === 'PUT'), controle.expectOne(r => r.method === 'DELETE')];
      expect(post.request.url).toBe('/api/caminhoes');
      expect(post.request.body).toEqual(corpo);
      expect(put.request.url).toBe('/api/caminhoes/9');
      expect(del.request.url).toBe('/api/caminhoes/9');
      post.flush(CAMINHOES_DONO_MOCK[0]);
      put.flush(CAMINHOES_DONO_MOCK[0]);
      del.flush(null, { status: 204, statusText: 'No Content' });
    });

    it('repassa o erro HTTP (ex.: 403 do MOTORISTA) sem transformar em sucesso', () => {
      let status = 0;
      TestBed.inject(CaminhoesService).excluir(1).subscribe({ error: e => (status = e.status) });
      controle.expectOne('/api/caminhoes/1').flush({ status: 403, erro: 'Acesso negado', detalhes: [] }, { status: 403, statusText: 'Forbidden' });
      expect(status).toBe(403);
    });
  });

  describe('MotoristasService', () => {
    it('cobre as 7 rotas de motoristas com o método e o corpo corretos', () => {
      const servico = TestBed.inject(MotoristasService);
      servico.listar().subscribe();
      servico.obter(31).subscribe();
      servico.convidar({ nome: 'Ana', email: 'ana@exemplo.com', caminhaoIds: [1] }).subscribe();
      servico.atualizar(31, { nome: 'Carlos', ativo: false }).subscribe();
      servico.vincular(31, { caminhaoIds: [] }).subscribe();
      servico.reenviarConvite(33).subscribe();
      servico.cancelarConvite(33).subscribe();
      const reqs = controle.match(() => true);
      expect(reqs.map(r => `${r.request.method} ${r.request.url}`)).toEqual([
        'GET /api/motoristas',
        'GET /api/motoristas/31',
        'POST /api/motoristas',
        'PUT /api/motoristas/31',
        'PUT /api/motoristas/31/caminhoes',
        'POST /api/motoristas/33/convite',
        'DELETE /api/motoristas/33/convite'
      ]);
      expect(reqs[2].request.body).toEqual({ nome: 'Ana', email: 'ana@exemplo.com', caminhaoIds: [1] });
      expect(reqs[3].request.body).toEqual({ nome: 'Carlos', ativo: false });
      expect(reqs[4].request.body).toEqual({ caminhaoIds: [] });
      reqs.forEach(r => r.flush(r.request.url.endsWith('/motoristas') && r.request.method === 'GET' ? MOTORISTAS_MOCK : MOTORISTAS_MOCK[0]));
    });
  });
});
