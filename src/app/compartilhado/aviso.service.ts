import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FalhaApi, normalizarFalha } from '../core/http/falha-api';

/** Mensagens curtas ao usuário (barra inferior do Material). */
@Injectable({ providedIn: 'root' })
export class AvisoService {
  private readonly snackBar = inject(MatSnackBar);

  mostrar(mensagem: string): void {
    this.snackBar.open(mensagem, 'Fechar', { duration: 6000 });
  }

  /**
   * Mostra a falha de uma chamada com os `detalhes` do servidor e devolve a falha
   * normalizada. `401` não é mostrado aqui: o interceptor já leva ao login com aviso.
   */
  falha(erro: unknown): FalhaApi {
    const falha = normalizarFalha(erro);
    if (falha.status !== 401) this.mostrar(falha.detalhes.join(' '));
    return falha;
  }

  /**
   * @deprecated Transitório: usado só pelas telas ainda não integradas (removido na integração delas).
   * Deixa claro que nada foi gravado (nunca simula sucesso).
   */
  integracaoPendente(acao: string): void {
    this.mostrar(`${acao}: a comunicação com o servidor ainda não foi integrada. Nada foi gravado.`);
  }
}
