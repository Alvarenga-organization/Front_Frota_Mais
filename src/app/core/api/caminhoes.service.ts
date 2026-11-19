import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CaminhaoRequest, CaminhaoResponse } from '../modelos/api.modelos';
import { API_URL, parametros } from '../http/api.config';

/**
 * Caminhões (`/api/caminhoes`).
 * DONO: todos da empresa (excluídos só com `incluirExcluidos`); cria, altera e exclui.
 * MOTORISTA: só os vinculados e não excluídos (o servidor filtra; o parâmetro é ignorado); escrita = 403.
 */
@Injectable({ providedIn: 'root' })
export class CaminhoesService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/caminhoes`;

  /** GET /caminhoes. Ordem do servidor: placa, depois id. */
  listar(incluirExcluidos = false): Observable<CaminhaoResponse[]> {
    return this.http.get<CaminhaoResponse[]>(this.url, { params: parametros({ incluirExcluidos: incluirExcluidos || null }) });
  }

  obter(id: number): Observable<CaminhaoResponse> {
    return this.http.get<CaminhaoResponse>(`${this.url}/${id}`);
  }

  /** POST (201). `409` = placa duplicada entre os não excluídos. */
  criar(dados: CaminhaoRequest): Observable<CaminhaoResponse> {
    return this.http.post<CaminhaoResponse>(this.url, dados);
  }

  /**
   * PUT (substituição integral, `status` obrigatório). Também inativa/reativa.
   * `409` = placa duplicada, viagem em andamento ao inativar, caminhão excluído.
   */
  atualizar(id: number, dados: CaminhaoRequest): Observable<CaminhaoResponse> {
    return this.http.put<CaminhaoResponse>(`${this.url}/${id}`, dados);
  }

  /** DELETE (204): exclusão lógica, preserva o histórico. `409` = viagem em andamento ou já excluído. */
  excluir(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
