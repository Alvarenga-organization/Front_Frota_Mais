import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { autenticacaoInterceptor } from './autenticacao.interceptor';
import { SessaoService } from '../sessao/sessao.service';
import { entrarComo, limparSessao } from '../../../testes/sessao-de-teste';

describe('autenticacaoInterceptor', () => {
  let http: HttpClient;
  let controle: HttpTestingController;
  let router: Router;
  let dialog: jasmine.SpyObj<MatDialog>;

  beforeEach(() => {
    limparSessao();
    dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['closeAll']);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([autenticacaoInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MatDialog, useValue: dialog }
      ]
    });
    http = TestBed.inject(HttpClient);
    controle = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
  });

  afterEach(() => {
    controle.verify();
    limparSessao();
  });

  it('anexa Authorization: Bearer nas rotas protegidas', () => {
    const sessao = entrarComo('DONO');
    http.get('/api/caminhoes').subscribe();
    const req = controle.expectOne('/api/caminhoes');
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${sessao.token()}`);
    req.flush([]);
  });

  it('anexa o token na troca de senha (rota protegida de /auth)', () => {
    entrarComo('MOTORISTA');
    http.post('/api/auth/senha', {}).subscribe();
    const req = controle.expectOne('/api/auth/senha');
    expect(req.request.headers.has('Authorization')).toBeTrue();
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  for (const rota of ['/api/auth/login', '/api/auth/registro', '/api/convites/ativacao']) {
    it(`não envia token na rota pública ${rota}`, () => {
      entrarComo('DONO');
      http.post(rota, {}).subscribe();
      const req = controle.expectOne(rota);
      expect(req.request.headers.has('Authorization')).toBeFalse();
      req.flush({});
    });
  }

  it('não envia token para URLs fora da API', () => {
    entrarComo('DONO');
    http.get('https://outro-dominio.exemplo/api/caminhoes').subscribe();
    http.get('/apix/caminhoes').subscribe();
    controle.match(() => true).forEach(req => {
      expect(req.request.headers.has('Authorization')).toBeFalse();
      req.flush({});
    });
  });

  it('sem sessão, a chamada protegida sai sem token (o servidor responde 401)', () => {
    http.get('/api/caminhoes').subscribe({ error: () => undefined });
    const req = controle.expectOne('/api/caminhoes');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({ status: 401, erro: 'Não autenticado', detalhes: [] }, { status: 401, statusText: 'Unauthorized' });
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('401 em rota protegida: encerra a sessão, fecha janelas, vai ao login e repassa o erro', () => {
    const sessao = entrarComo('DONO');
    let status = 0;
    http.get('/api/viagens').subscribe({ error: e => (status = e.status) });
    controle.expectOne('/api/viagens').flush(
      { status: 401, erro: 'Não autenticado', detalhes: ['Token expirado.'] }, { status: 401, statusText: 'Unauthorized' });
    expect(status).toBe(401);
    expect(sessao.sessao()).toBeNull();
    expect(sessao.consumirMotivo()).toBe('expirada');
    expect(dialog.closeAll).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/login');
  });

  it('vários 401 simultâneos redirecionam uma única vez (sem laço)', () => {
    entrarComo('DONO');
    http.get('/api/caminhoes').subscribe({ error: () => undefined });
    http.get('/api/viagens').subscribe({ error: () => undefined });
    controle.match(() => true).forEach(req =>
      req.flush({ status: 401, erro: 'Não autenticado', detalhes: [] }, { status: 401, statusText: 'Unauthorized' }));
    expect(router.navigateByUrl).toHaveBeenCalledTimes(1);
  });

  it('401 no login é credencial inválida: não mexe na sessão nem redireciona', () => {
    const sessao = entrarComo('DONO');
    http.post('/api/auth/login', {}).subscribe({ error: () => undefined });
    controle.expectOne('/api/auth/login').flush(
      { status: 401, erro: 'Não autenticado', detalhes: ['E-mail ou senha inválidos.'] }, { status: 401, statusText: 'Unauthorized' });
    expect(sessao.sessao()).not.toBeNull();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('403 não desloga: o erro segue para a tela', () => {
    const sessao = entrarComo('MOTORISTA');
    let status = 0;
    http.get('/api/motoristas').subscribe({ error: e => (status = e.status) });
    controle.expectOne('/api/motoristas').flush(
      { status: 403, erro: 'Acesso negado', detalhes: ['Sem permissão.'] }, { status: 403, statusText: 'Forbidden' });
    expect(status).toBe(403);
    expect(sessao.sessao()).not.toBeNull();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('não escreve o token no console', () => {
    const espioes = (['log', 'info', 'warn', 'error', 'debug'] as const).map(m => spyOn(console, m));
    const sessao = entrarComo('DONO');
    http.get('/api/caminhoes').subscribe({ error: () => undefined });
    controle.expectOne('/api/caminhoes').flush(null, { status: 401, statusText: 'Unauthorized' });
    const token = TestBed.inject(SessaoService).token() ?? sessao.sessao()?.token ?? 'x';
    for (const espiao of espioes) {
      for (const chamada of espiao.calls.allArgs()) {
        expect(JSON.stringify(chamada)).not.toContain(token);
      }
    }
  });
});
