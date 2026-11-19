import { Injectable, computed, signal } from '@angular/core';
import { AutenticacaoResponse, Perfil } from '../modelos/api.modelos';
import { lerPayloadJwt } from './jwt';

export interface DadosSessao {
  token: string;
  nome: string;
  perfil: Perfil;
  /** Id do próprio usuário (claim `sub`), usado só pela interface (ex.: "eu mesmo" como responsável). */
  usuarioId: number | null;
  /** Expiração do token em milissegundos (claim `exp`); nulo se ausente. */
  expiraEm: number | null;
}

/** Por que a sessão terminou sem o usuário pedir (mostrado uma vez na tela de login). */
export type MotivoEncerramento = 'expirada';

const CHAVE = 'frota.sessao';

/**
 * Sessão do usuário (decisão aprovada: `sessionStorage`, válida só na aba).
 *
 * Guarda o token JWT devolvido por login, registro ou ativação, mais o nome e o
 * perfil para montar a interface. Isso **não** protege o token contra XSS: qualquer
 * script na página consegue ler o `sessionStorage`. A mitigação é não injetar HTML
 * externo (sem `innerHTML`/`bypassSecurityTrust*` com dados da API).
 *
 * O payload do JWT é lido **sem verificar a assinatura**: serve só para a interface
 * (expiração e id do usuário). Quem autoriza é o servidor, a cada requisição.
 */
@Injectable({ providedIn: 'root' })
export class SessaoService {
  private readonly dados = signal<DadosSessao | null>(this.ler());
  private readonly motivo = signal<MotivoEncerramento | null>(null);

  readonly sessao = this.dados.asReadonly();
  readonly perfil = computed(() => this.dados()?.perfil ?? null);
  readonly ehDono = computed(() => this.dados()?.perfil === 'DONO');
  readonly nome = computed(() => this.dados()?.nome ?? '');
  readonly usuarioId = computed(() => this.dados()?.usuarioId ?? null);

  /** Abre a sessão com a resposta de login, registro ou ativação de convite. */
  iniciar(resposta: AutenticacaoResponse): void {
    const payload = lerPayloadJwt(resposta.token);
    const sub = payload?.sub !== undefined ? Number(payload.sub) : NaN;
    const dados: DadosSessao = {
      token: resposta.token,
      nome: resposta.nome,
      perfil: resposta.perfil,
      usuarioId: Number.isSafeInteger(sub) ? sub : null,
      expiraEm: typeof payload?.exp === 'number' ? payload.exp * 1000 : null
    };
    this.motivo.set(null);
    this.dados.set(dados);
    try {
      sessionStorage.setItem(CHAVE, JSON.stringify(dados));
    } catch {
      // Armazenamento indisponível: a sessão vale só enquanto a página estiver aberta.
    }
  }

  /** Token para o cabeçalho `Authorization`; nulo sem sessão. Nunca registrar em log. */
  token(): string | null {
    return this.dados()?.token ?? null;
  }

  /**
   * Confere a sessão local: sem sessão ou com token já vencido → falso (e limpa).
   * Isto só evita telas com token sabidamente expirado; o `401` do servidor continua
   * sendo a fonte de verdade.
   */
  valida(agora = Date.now()): boolean {
    const dados = this.dados();
    if (!dados) return false;
    if (dados.expiraEm !== null && dados.expiraEm <= agora) {
      this.encerrar('expirada');
      return false;
    }
    return true;
  }

  /** Sair: descarta token, nome e perfil (nada de um usuário fica para o próximo). */
  encerrar(motivo: MotivoEncerramento | null = null): void {
    this.dados.set(null);
    this.motivo.set(motivo);
    try {
      sessionStorage.removeItem(CHAVE);
    } catch {
      // Nada a limpar.
    }
  }

  /** Motivo do último encerramento automático; lido uma vez (a tela de login mostra e descarta). */
  consumirMotivo(): MotivoEncerramento | null {
    const motivo = this.motivo();
    this.motivo.set(null);
    return motivo;
  }

  private ler(): DadosSessao | null {
    try {
      const bruto = sessionStorage.getItem(CHAVE);
      if (!bruto) return null;
      const dados = JSON.parse(bruto) as Partial<DadosSessao>;
      const perfilValido = dados.perfil === 'DONO' || dados.perfil === 'MOTORISTA';
      if (perfilValido && typeof dados.nome === 'string' && typeof dados.token === 'string' && dados.token) {
        return {
          token: dados.token,
          nome: dados.nome,
          perfil: dados.perfil as Perfil,
          usuarioId: typeof dados.usuarioId === 'number' ? dados.usuarioId : null,
          expiraEm: typeof dados.expiraEm === 'number' ? dados.expiraEm : null
        };
      }
      sessionStorage.removeItem(CHAVE);
    } catch {
      // Conteúdo inválido: ignora.
    }
    return null;
  }
}
