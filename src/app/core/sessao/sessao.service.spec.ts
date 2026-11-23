import { TestBed } from '@angular/core/testing';
import { SessaoService } from './sessao.service';
import { lerPayloadJwt } from './jwt';
import { limparSessao, tokenDeTeste } from '../../../testes/sessao-de-teste';

describe('SessaoService', () => {
  beforeEach(() => limparSessao());
  afterEach(() => limparSessao());

  it('inicia com a resposta de autenticação e guarda token, nome, perfil, id (sub) e expiração', () => {
    const exp = Math.floor(Date.now() / 1000) + 600;
    const sessao = TestBed.inject(SessaoService);
    sessao.iniciar({ token: tokenDeTeste(7, exp), nome: 'Ana', perfil: 'DONO' });
    expect(sessao.token()).toBe(tokenDeTeste(7, exp));
    expect(sessao.nome()).toBe('Ana');
    expect(sessao.ehDono()).toBeTrue();
    expect(sessao.usuarioId()).toBe(7);
    expect(sessao.sessao()?.expiraEm).toBe(exp * 1000);
    expect(JSON.parse(sessionStorage.getItem('frota.sessao')!).token).toBe(tokenDeTeste(7, exp));
  });

  it('nunca guarda senha', () => {
    TestBed.inject(SessaoService).iniciar({ token: tokenDeTeste(), nome: 'Ana', perfil: 'DONO' });
    expect(sessionStorage.getItem('frota.sessao')).not.toContain('senha');
  });

  it('recupera a sessão do sessionStorage ao recarregar a página', () => {
    TestBed.inject(SessaoService).iniciar({ token: tokenDeTeste(31), nome: 'Carlos', perfil: 'MOTORISTA' });
    TestBed.resetTestingModule();
    const recarregada = TestBed.inject(SessaoService);
    expect(recarregada.perfil()).toBe('MOTORISTA');
    expect(recarregada.valida()).toBeTrue();
  });

  it('token vencido: a sessão local é inválida, é limpa e registra o motivo', () => {
    const sessao = TestBed.inject(SessaoService);
    sessao.iniciar({ token: tokenDeTeste(1, Math.floor(Date.now() / 1000) - 10), nome: 'Ana', perfil: 'DONO' });
    expect(sessao.valida()).toBeFalse();
    expect(sessao.sessao()).toBeNull();
    expect(sessionStorage.getItem('frota.sessao')).toBeNull();
    expect(sessao.consumirMotivo()).toBe('expirada');
    expect(sessao.consumirMotivo()).toBeNull();
  });

  it('sem sessão, valida() é falso', () => {
    expect(TestBed.inject(SessaoService).valida()).toBeFalse();
  });

  it('encerrar limpa tudo', () => {
    const sessao = TestBed.inject(SessaoService);
    sessao.iniciar({ token: tokenDeTeste(), nome: 'Ana', perfil: 'DONO' });
    sessao.encerrar();
    expect(sessao.token()).toBeNull();
    expect(sessao.perfil()).toBeNull();
    expect(sessionStorage.getItem('frota.sessao')).toBeNull();
  });

  it('descarta conteúdo adulterado no sessionStorage (perfil desconhecido ou sem token)', () => {
    sessionStorage.setItem('frota.sessao', JSON.stringify({ nome: 'X', perfil: 'ADMIN', token: 'a.b.c' }));
    expect(TestBed.inject(SessaoService).sessao()).toBeNull();
    TestBed.resetTestingModule();
    sessionStorage.setItem('frota.sessao', JSON.stringify({ nome: 'X', perfil: 'DONO' }));
    expect(TestBed.inject(SessaoService).sessao()).toBeNull();
  });

  it('token sem formato JWT: sessão aberta sem id nem expiração (o servidor decide pelo 401)', () => {
    const sessao = TestBed.inject(SessaoService);
    sessao.iniciar({ token: 'opaco', nome: 'Ana', perfil: 'DONO' });
    expect(sessao.usuarioId()).toBeNull();
    expect(sessao.valida()).toBeTrue();
  });
});

describe('lerPayloadJwt', () => {
  it('lê o payload em base64url', () => {
    expect(lerPayloadJwt(tokenDeTeste(12, 2000000000))?.sub).toBe('12');
  });

  it('devolve null para tokens malformados', () => {
    expect(lerPayloadJwt('abc')).toBeNull();
    expect(lerPayloadJwt('a.%%%.c')).toBeNull();
    expect(lerPayloadJwt(`a.${btoa('[1,2]')}.c`)).toBeNull();
  });
});
