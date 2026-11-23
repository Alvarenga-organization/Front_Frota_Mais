/** Claims do JWT do Frota+ usadas pela interface (`sub` = id do usuário, `exp` em segundos). */
export interface PayloadJwt {
  sub?: string;
  exp?: number;
  [claim: string]: unknown;
}

/**
 * Lê o payload de um JWT **sem verificar a assinatura**. Só para a interface;
 * nunca use o resultado como prova de identidade ou de permissão.
 * Devolve `null` se o token não tiver o formato esperado.
 */
export function lerPayloadJwt(token: string): PayloadJwt | null {
  const partes = token.split('.');
  if (partes.length !== 3 || !partes[1]) return null;
  try {
    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const completo = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(completo), c => c.charCodeAt(0));
    const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as PayloadJwt) : null;
  } catch {
    return null;
  }
}
