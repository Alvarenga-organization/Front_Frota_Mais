import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { catchError, throwError, timeout } from 'rxjs';
import { SessaoService } from '../sessao/sessao.service';
import { API_URL, TEMPO_LIMITE_API_MS, caminhoNaApi, ehRotaPublica } from './api.config';

/**
 * Interceptor das chamadas à API:
 * - anexa `Authorization: Bearer <token>` só nas rotas protegidas da própria API
 *   (nunca em login, registro, ativação nem em URLs de outros domínios);
 * - `401` numa rota protegida = sessão inválida (token vencido, adulterado, usuário
 *   desativado): limpa a sessão, fecha janelas abertas e leva ao login com aviso.
 *   Só redireciona se havia sessão, o que evita laço quando várias chamadas falham juntas;
 * - `401` em rota pública (login) é credencial inválida e segue para a tela tratar;
 * - `403` e demais erros seguem intactos para a tela (não deslogam);
 * - sem resposta em `TEMPO_LIMITE_API_MS`, a chamada falha com `TimeoutError`.
 * Nada é registrado em log, e o erro original é repassado sem alteração.
 */
export const autenticacaoInterceptor: HttpInterceptorFn = (req, next) => {
  const caminho = caminhoNaApi(req.url, inject(API_URL));
  if (caminho === null) return next(req);

  const sessao = inject(SessaoService);
  const router = inject(Router);
  const dialog = inject(MatDialog);
  const publica = ehRotaPublica(caminho);
  const token = publica ? null : sessao.token();
  const pedido = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(pedido).pipe(
    // Sem resposta no prazo: `TimeoutError`, tratado em `normalizarFalha` (a requisição não é repetida).
    timeout(TEMPO_LIMITE_API_MS),
    catchError((erro: unknown) => {
      if (!publica && erro instanceof HttpErrorResponse && erro.status === 401 && sessao.sessao()) {
        sessao.encerrar('expirada');
        dialog.closeAll();
        router.navigateByUrl('/login');
      }
      return throwError(() => erro);
    })
  );
};
