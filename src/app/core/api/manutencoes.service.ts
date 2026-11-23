import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DataIso, ManutencaoRequest, ManutencaoResponse } from '../modelos/api.modelos';
import { API_URL, parametros } from '../http/api.config';

export interface FiltroManutencoes {
  caminhaoId?: number | null;
  de?: DataIso | null;
  ate?: DataIso | null;
  incluirExcluidas?: boolean;
}

/**
 * Manutenções (`/api/manutencoes`), só DONO. Pertencem ao caminhão e entram só no
 * resultado do período; nunca a um frete. Exclusão lógica.
 */
@Injectable({ providedIn: 'root' })
export class ManutencoesService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/manutencoes`;

  /** GET com filtros opcionais. Ordem: data desc, id desc. `400` = `ate` < `de` ou data malformada. */
  listar(filtro: FiltroManutencoes = {}): Observable<ManutencaoResponse[]> {
    return this.http.get<ManutencaoResponse[]>(this.url, {
      params: parametros({ caminhaoId: filtro.caminhaoId, de: filtro.de, ate: filtro.ate, incluirExcluidas: filtro.incluirExcluidas || null })
    });
  }

  obter(id: number): Observable<ManutencaoResponse> {
    return this.http.get<ManutencaoResponse>(`${this.url}/${id}`);
  }

  /** POST (201). `409` = caminhão excluído. */
  criar(dados: ManutencaoRequest): Observable<ManutencaoResponse> {
    return this.http.post<ManutencaoResponse>(this.url, dados);
  }

  /** PUT (integral; pode trocar o caminhão). `409` = manutenção ou caminhão excluído. */
  atualizar(id: number, dados: ManutencaoRequest): Observable<ManutencaoResponse> {
    return this.http.put<ManutencaoResponse>(`${this.url}/${id}`, dados);
  }

  /** DELETE (204): exclusão lógica. `409` = já excluída ou caminhão excluído. */
  excluir(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
