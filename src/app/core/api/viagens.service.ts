import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AberturaViagemRequest, AlteracaoViagemMotoristaRequest, AlteracaoViagemRequest, AlteracaoViagemResponse,
  CancelamentoViagemRequest, FiltroViagens, FinalizacaoViagemRequest, FotografiaAnteriorResponse,
  ViagemHistoricaRequest, ViagemResponse, ViagemResumoResponse
} from '../modelos/api.modelos';
import { API_URL, parametros } from '../http/api.config';

/**
 * Viagens (fretes): `/api/viagens`.
 * Não existe exclusão, reabertura, filtro por data nem paginação.
 * Para o MOTORISTA, campos financeiros vêm `null` e `rentabilidade` é `null`.
 */
@Injectable({ providedIn: 'root' })
export class ViagensService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/viagens`;

  /** GET com filtros opcionais `status` e `caminhaoId`. Ordem: dataInicio desc, id desc. */
  listar(filtro: FiltroViagens = {}): Observable<ViagemResumoResponse[]> {
    return this.http.get<ViagemResumoResponse[]>(this.url, {
      params: parametros({ status: filtro.status, caminhaoId: filtro.caminhaoId })
    });
  }

  /** GET /{id}. `404` = inexistente, de outra empresa ou fora do vínculo do MOTORISTA. */
  obter(id: number): Observable<ViagemResponse> {
    return this.http.get<ViagemResponse>(`${this.url}/${id}`);
  }

  /** POST (201): abre a viagem, opcionalmente com abastecimentos anteriores na mesma transação. */
  abrir(dados: AberturaViagemRequest): Observable<ViagemResponse> {
    return this.http.post<ViagemResponse>(this.url, dados);
  }

  /**
   * PUT /{id}: substituição integral (carregamento, alteração, correção de encerrada pelo DONO).
   * DONO: reenviar `motoristaId` atual (ausente remove o responsável).
   * MOTORISTA: sem `motoristaId` (mantém o atual).
   */
  atualizar(id: number, dados: AlteracaoViagemRequest | AlteracaoViagemMotoristaRequest): Observable<ViagemResponse> {
    return this.http.put<ViagemResponse>(`${this.url}/${id}`, dados);
  }

  /** POST /{id}/finalizar. `400` lista o que falta (valor do frete, origem, destino...). */
  finalizar(id: number, dados: FinalizacaoViagemRequest): Observable<ViagemResponse> {
    return this.http.post<ViagemResponse>(`${this.url}/${id}/finalizar`, dados);
  }

  /** POST /{id}/cancelar (só DONO, só em andamento, motivo obrigatório). */
  cancelar(id: number, dados: CancelamentoViagemRequest): Observable<ViagemResponse> {
    return this.http.post<ViagemResponse>(`${this.url}/${id}/cancelar`, dados);
  }

  /** POST /historicas (só DONO): frete já finalizado, numa só operação. */
  registrarHistorica(dados: ViagemHistoricaRequest): Observable<ViagemResponse> {
    return this.http.post<ViagemResponse>(`${this.url}/historicas`, dados);
  }

  /** GET /{id}/alteracoes (só DONO): auditoria campo a campo, em ordem cronológica. */
  alteracoes(id: number): Observable<AlteracaoViagemResponse[]> {
    return this.http.get<AlteracaoViagemResponse[]>(`${this.url}/${id}/alteracoes`);
  }

  /** GET /{id}/fotografias-anteriores (só DONO). */
  fotografiasAnteriores(id: number): Observable<FotografiaAnteriorResponse[]> {
    return this.http.get<FotografiaAnteriorResponse[]>(`${this.url}/${id}/fotografias-anteriores`);
  }
}
