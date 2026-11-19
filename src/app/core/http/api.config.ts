import { InjectionToken } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/** URL base da API (sem barra no fim). Vem do ambiente; nunca fixa no código. */
export const API_URL = new InjectionToken<string>('API_URL', {
  providedIn: 'root',
  factory: () => environment.apiUrl.replace(/\/+$/, '')
});

/**
 * Rotas públicas (sem `Authorization`): registro, login e ativação de convite.
 * `/auth/senha` é protegida e por isso não está aqui.
 */
export const ROTAS_PUBLICAS = ['/auth/login', '/auth/registro', '/convites/ativacao'] as const;

/** Caminho relativo à API (`/caminhoes/1`) ou `null` se a URL não for da API. */
export function caminhoNaApi(url: string, apiUrl: string): string | null {
  const semConsulta = url.split(/[?#]/)[0];
  if (semConsulta === apiUrl) return '';
  return semConsulta.startsWith(`${apiUrl}/`) ? semConsulta.slice(apiUrl.length) : null;
}

export function ehRotaPublica(caminho: string): boolean {
  return (ROTAS_PUBLICAS as readonly string[]).includes(caminho);
}

/** Parâmetros de consulta sem os vazios (nulo, indefinido ou texto vazio não são enviados). */
export function parametros(valores: Record<string, string | number | boolean | null | undefined>): HttpParams {
  let params = new HttpParams();
  for (const [chave, valor] of Object.entries(valores)) {
    if (valor !== null && valor !== undefined && valor !== '') params = params.set(chave, String(valor));
  }
  return params;
}
