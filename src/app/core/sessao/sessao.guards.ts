import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Perfil } from '../modelos/api.modelos';
import { SessaoService } from './sessao.service';

/**
 * Áreas internas exigem sessão local válida (token presente e não vencido);
 * sem ela, vai ao login. Quem autoriza de fato é o servidor (401/403).
 */
export const sessaoAtivaGuard: CanActivateFn = () => {
  return inject(SessaoService).valida() ? true : inject(Router).createUrlTree(['/login']);
};

/** Login, criar conta e ativação: quem já está na sessão vai ao início. */
export const semSessaoGuard: CanActivateFn = () => {
  return inject(SessaoService).valida() ? inject(Router).createUrlTree(['/inicio']) : true;
};

/**
 * Restringe rotas por perfil (rotas com `data.perfis`). É experiência, não segurança:
 * o servidor responde 403 de qualquer forma.
 */
export const perfilGuard: CanActivateFn = route => {
  const perfis = route.data['perfis'] as Perfil[] | undefined;
  const perfil = inject(SessaoService).perfil();
  if (!perfis || (perfil && perfis.includes(perfil))) return true;
  return inject(Router).createUrlTree(['/inicio']);
};
