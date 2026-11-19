import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import {
  AtivacaoConviteRequest, AutenticacaoResponse, LoginRequest, RegistroRequest, TrocaSenhaRequest
} from '../modelos/api.modelos';
import { API_URL } from '../http/api.config';
import { SessaoService } from '../sessao/sessao.service';

/**
 * Autenticação e conta. Login, registro e ativação devolvem `{ token, nome, perfil }`
 * e já abrem a sessão. Não há refresh token, logout no servidor nem recuperação de senha.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly sessao = inject(SessaoService);

  /** POST /auth/login. `401` aqui = credenciais inválidas (não é sessão expirada). */
  entrar(dados: LoginRequest): Observable<AutenticacaoResponse> {
    return this.http.post<AutenticacaoResponse>(`${this.api}/auth/login`, dados)
      .pipe(tap(resposta => this.sessao.iniciar(resposta)));
  }

  /** POST /auth/registro: cria a empresa e o DONO (201). `409` = e-mail já cadastrado. */
  registrar(dados: RegistroRequest): Observable<AutenticacaoResponse> {
    return this.http.post<AutenticacaoResponse>(`${this.api}/auth/registro`, dados)
      .pipe(tap(resposta => this.sessao.iniciar(resposta)));
  }

  /** POST /convites/ativacao: o motorista cria a senha e já entra. `400` = convite inválido ou senha fraca. */
  ativarConvite(dados: AtivacaoConviteRequest): Observable<AutenticacaoResponse> {
    return this.http.post<AutenticacaoResponse>(`${this.api}/convites/ativacao`, dados)
      .pipe(tap(resposta => this.sessao.iniciar(resposta)));
  }

  /** POST /auth/senha (204). `400` = senha atual incorreta ou nova fraca: **não** desloga. */
  trocarSenha(dados: TrocaSenhaRequest): Observable<void> {
    return this.http.post<void>(`${this.api}/auth/senha`, dados);
  }

  /** Sair: só local (não existe logout no servidor). */
  sair(): void {
    this.sessao.encerrar();
  }
}
