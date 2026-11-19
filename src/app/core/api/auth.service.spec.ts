import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { SessaoService } from '../sessao/sessao.service';
import { limparSessao, tokenDeTeste } from '../../../testes/sessao-de-teste';

describe('AuthService', () => {
  let servico: AuthService;
  let sessao: SessaoService;
  let controle: HttpTestingController;

  beforeEach(() => {
    limparSessao();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servico = TestBed.inject(AuthService);
    sessao = TestBed.inject(SessaoService);
    controle = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    controle.verify();
    limparSessao();
  });

  it('login: POST /api/auth/login com e-mail e senha e abre a sessão', () => {
    servico.entrar({ email: 'ana@exemplo.com', senha: 'senhaForte1' }).subscribe();
    const req = controle.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'ana@exemplo.com', senha: 'senhaForte1' });
    req.flush({ token: tokenDeTeste(1), nome: 'Ana', perfil: 'DONO' });
    expect(sessao.perfil()).toBe('DONO');
    expect(sessao.nome()).toBe('Ana');
  });

  it('login recusado (401): não abre sessão e repassa o erro', () => {
    let status = 0;
    servico.entrar({ email: 'ana@exemplo.com', senha: 'errada123' }).subscribe({ error: e => (status = e.status) });
    controle.expectOne('/api/auth/login').flush(
      { status: 401, erro: 'Não autenticado', detalhes: ['E-mail ou senha inválidos.'] }, { status: 401, statusText: 'Unauthorized' });
    expect(status).toBe(401);
    expect(sessao.sessao()).toBeNull();
  });

  it('registro: POST /api/auth/registro com nomeEmpresa, nome, email e senha (sem perfil nem empresaId)', () => {
    servico.registrar({ nomeEmpresa: 'Transportes X', nome: 'Ana', email: 'ana@exemplo.com', senha: 'senhaForte1' }).subscribe();
    const req = controle.expectOne('/api/auth/registro');
    expect(req.request.method).toBe('POST');
    expect(Object.keys(req.request.body).sort()).toEqual(['email', 'nome', 'nomeEmpresa', 'senha']);
    req.flush({ token: tokenDeTeste(1), nome: 'Ana', perfil: 'DONO' }, { status: 201, statusText: 'Created' });
    expect(sessao.ehDono()).toBeTrue();
  });

  it('registro com e-mail duplicado (409) não abre sessão', () => {
    servico.registrar({ nomeEmpresa: 'X', nome: 'Ana', email: 'ana@exemplo.com', senha: 'senhaForte1' }).subscribe({ error: () => undefined });
    controle.expectOne('/api/auth/registro').flush(
      { status: 409, erro: 'Conflito de dados', detalhes: ['E-mail já cadastrado.'] }, { status: 409, statusText: 'Conflict' });
    expect(sessao.sessao()).toBeNull();
  });

  it('ativação de convite: POST /api/convites/ativacao { token, senha } e entra como MOTORISTA', () => {
    servico.ativarConvite({ token: 'convite-abc', senha: 'minhaSenha1' }).subscribe();
    const req = controle.expectOne('/api/convites/ativacao');
    expect(req.request.body).toEqual({ token: 'convite-abc', senha: 'minhaSenha1' });
    req.flush({ token: tokenDeTeste(31), nome: 'Carlos', perfil: 'MOTORISTA' });
    expect(sessao.perfil()).toBe('MOTORISTA');
    expect(sessao.usuarioId()).toBe(31);
  });

  it('troca de senha: POST /api/auth/senha (204) sem mexer na sessão', () => {
    sessao.iniciar({ token: tokenDeTeste(1), nome: 'Ana', perfil: 'DONO' });
    let concluiu = false;
    servico.trocarSenha({ senhaAtual: 'senhaForte1', novaSenha: 'outraSenha2' }).subscribe(() => (concluiu = true));
    const req = controle.expectOne('/api/auth/senha');
    expect(req.request.body).toEqual({ senhaAtual: 'senhaForte1', novaSenha: 'outraSenha2' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(concluiu).toBeTrue();
    expect(sessao.sessao()).not.toBeNull();
  });

  it('sair: limpa a sessão localmente, sem chamar o servidor', () => {
    sessao.iniciar({ token: tokenDeTeste(1), nome: 'Ana', perfil: 'DONO' });
    servico.sair();
    expect(sessao.sessao()).toBeNull();
    controle.expectNone(() => true);
  });
});
