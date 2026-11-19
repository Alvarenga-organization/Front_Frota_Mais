import { TestBed } from '@angular/core/testing';
import { Perfil } from '../app/core/modelos/api.modelos';
import { SessaoService } from '../app/core/sessao/sessao.service';

function base64Url(texto: string): string {
  return btoa(texto).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * JWT **falso** (assinatura inválida) para testes. O front-end não verifica a
 * assinatura; só lê `sub` e `exp` para a interface.
 */
export function tokenDeTeste(sub = 1, expiraEmSegundos = Math.floor(Date.now() / 1000) + 3600, perfil: Perfil = 'DONO'): string {
  const cabecalho = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({ sub: String(sub), empresaId: 1, perfil, iat: 0, exp: expiraEmSegundos, iss: 'teste' }));
  return `${cabecalho}.${payload}.assinatura-de-teste`;
}

/** Abre uma sessão com o perfil pedido (apenas para testes). */
export function entrarComo(perfil: Perfil, sub = perfil === 'DONO' ? 1 : 31): SessaoService {
  const sessao = TestBed.inject(SessaoService);
  sessao.iniciar({ token: tokenDeTeste(sub, undefined, perfil), nome: `Teste ${perfil}`, perfil });
  return sessao;
}

/** Limpa a sessão gravada no sessionStorage entre os testes. */
export function limparSessao(): void {
  sessionStorage.clear();
}

/** Atalho para localizar elementos no DOM do componente. */
export function todos(raiz: HTMLElement, seletor: string): HTMLElement[] {
  return Array.from(raiz.querySelectorAll<HTMLElement>(seletor));
}
