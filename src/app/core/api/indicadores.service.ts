import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FiltroPeriodo, IndicadoresPorCaminhaoResponse, IndicadoresResponse } from '../modelos/api.modelos';
import { API_URL, parametros } from '../http/api.config';

/**
 * Indicadores (só DONO): `/api/viagens/indicadores` e `/por-caminhao`.
 * Um único filtro de período por vez: `ano`; `ano`+`mes`; `semana`; ou `de`/`ate`.
 * Sem filtro = todo o histórico. Totais, margem ponderada e resultados vêm prontos
 * do servidor; não há série mensal (uma chamada por mês).
 */
@Injectable({ providedIn: 'root' })
export class IndicadoresService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/viagens/indicadores`;

  doPeriodo(filtro: FiltroPeriodo = {}): Observable<IndicadoresResponse> {
    return this.http.get<IndicadoresResponse>(this.url, { params: parametros({ ...filtro }) });
  }

  /** Um item por caminhão com movimento no período (sem `caminhaoId`). */
  porCaminhao(filtro: Omit<FiltroPeriodo, 'caminhaoId'> = {}): Observable<IndicadoresPorCaminhaoResponse[]> {
    return this.http.get<IndicadoresPorCaminhaoResponse[]>(`${this.url}/por-caminhao`, { params: parametros({ ...filtro }) });
  }
}
