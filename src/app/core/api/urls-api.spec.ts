import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { API_URL } from '../http/api.config';
import { autenticacaoInterceptor } from '../http/autenticacao.interceptor';
import { AuthService } from './auth.service';
import { CaminhoesService } from './caminhoes.service';
import { IndicadoresService } from './indicadores.service';
import { LancamentosService } from './lancamentos.service';
import { ManutencoesService } from './manutencoes.service';
import { MotoristasService } from './motoristas.service';
import { ViagensService } from './viagens.service';
import { entrarComo, limparSessao } from '../../../testes/sessao-de-teste';

/**
 * Com a API em outro domínio (produção: `FROTA_API_URL` + `/api`), toda chamada de todos os
 * serviços sai para a URL absoluta configurada, com `/api` exatamente uma vez, e o token só vai
 * às rotas protegidas.
 */
describe('URLs finais da API (configuração centralizada)', () => {
  const API = 'https://servidor.frota.teste/api';
  let controle: HttpTestingController;

  beforeEach(() => {
    limparSessao();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([autenticacaoInterceptor])), provideHttpClientTesting(),
        { provide: API_URL, useValue: API },
        { provide: MatDialog, useValue: jasmine.createSpyObj<MatDialog>('MatDialog', ['closeAll']) }
      ]
    });
    controle = TestBed.inject(HttpTestingController);
    entrarComo('DONO');
  });

  afterEach(() => {
    controle.verify();
    limparSessao();
  });

  it('todos os serviços usam a URL configurada, sem /api duplicado nem chamada relativa', () => {
    const auth = TestBed.inject(AuthService);
    const caminhoes = TestBed.inject(CaminhoesService);
    const motoristas = TestBed.inject(MotoristasService);
    const viagens = TestBed.inject(ViagensService);
    const lancamentos = TestBed.inject(LancamentosService);
    const manutencoes = TestBed.inject(ManutencoesService);
    const indicadores = TestBed.inject(IndicadoresService);
    const abast = { tipo: 'DIESEL', data: '2025-03-06', quilometragem: 1, litros: '1', valorTotal: '6.00' } as const;
    const chamadas: Observable<unknown>[] = [
      auth.entrar({ email: 'a@b.c', senha: 'x' }), auth.registrar({ nomeEmpresa: 'E', nome: 'N', email: 'a@b.c', senha: 'x' }),
      auth.ativarConvite({ token: 't', senha: 'x' }), auth.trocarSenha({ senhaAtual: 'x', novaSenha: 'y' }),
      caminhoes.listar(), caminhoes.obter(1), caminhoes.excluir(1),
      motoristas.listar(), motoristas.reenviarConvite(3), motoristas.cancelarConvite(3),
      viagens.listar(), viagens.obter(205), viagens.alteracoes(205), viagens.fotografiasAnteriores(205),
      lancamentos.criar(205, 'abastecimentos', abast), lancamentos.atualizar(205, 'pedagios', 9, { data: '2025-03-06', valor: '1.00' }),
      lancamentos.excluir(205, 'despesas-extras', 9),
      manutencoes.listar(), indicadores.doPeriodo({ ano: 2025, mes: 3 }), indicadores.porCaminhao({ ano: 2025, mes: 3 })
    ];
    chamadas.forEach(c => c.subscribe({ error: () => undefined }));
    const reqs = controle.match(() => true);
    expect(reqs.map(r => r.request.url)).toEqual([
      `${API}/auth/login`, `${API}/auth/registro`, `${API}/convites/ativacao`, `${API}/auth/senha`,
      `${API}/caminhoes`, `${API}/caminhoes/1`, `${API}/caminhoes/1`,
      `${API}/motoristas`, `${API}/motoristas/3/convite`, `${API}/motoristas/3/convite`,
      `${API}/viagens`, `${API}/viagens/205`, `${API}/viagens/205/alteracoes`, `${API}/viagens/205/fotografias-anteriores`,
      `${API}/viagens/205/abastecimentos`, `${API}/viagens/205/pedagios/9`, `${API}/viagens/205/despesas-extras/9`,
      `${API}/manutencoes`, `${API}/viagens/indicadores`, `${API}/viagens/indicadores/por-caminhao`
    ]);
    for (const r of reqs) {
      expect(r.request.url.split('/api').length - 1).withContext(r.request.url).toBe(1);
      expect(r.request.url.startsWith('https://servidor.frota.teste/api/')).withContext(r.request.url).toBeTrue();
    }
    const comToken = (r: TestRequest) => r.request.headers.has('Authorization');
    // Login, registro e ativação nunca levam o token da sessão; o resto (inclusive /auth/senha) leva.
    expect(reqs.slice(0, 3).some(comToken)).toBeFalse();
    expect(reqs.slice(3).every(comToken)).toBeTrue();
    reqs.forEach(r => r.flush(null));
  });
});
