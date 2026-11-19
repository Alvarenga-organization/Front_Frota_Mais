import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AbastecimentoRequest, AbastecimentoResponse, DespesaExtraRequest, DespesaExtraResponse, PedagioRequest, PedagioResponse
} from '../modelos/api.modelos';
import { API_URL } from '../http/api.config';

/** Recursos de lançamento sob `/api/viagens/{viagemId}/`. */
export type TipoLancamento = 'abastecimentos' | 'pedagios' | 'despesas-extras';

interface ContratoLancamento {
  'abastecimentos': { requisicao: AbastecimentoRequest; resposta: AbastecimentoResponse };
  'pedagios': { requisicao: PedagioRequest; resposta: PedagioResponse };
  'despesas-extras': { requisicao: DespesaExtraRequest; resposta: DespesaExtraResponse };
}

/**
 * Abastecimentos (diesel e Arla), pedágios e despesas extras de uma viagem.
 * Não há GET próprio: os lançamentos vêm no detalhe da viagem.
 * A resposta **não** traz a rentabilidade: depois de criar, corrigir ou excluir,
 * recarregue `GET /api/viagens/{id}`.
 */
@Injectable({ providedIn: 'root' })
export class LancamentosService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);

  private url(viagemId: number, tipo: TipoLancamento, id?: number): string {
    return `${this.api}/viagens/${viagemId}/${tipo}${id === undefined ? '' : `/${id}`}`;
  }

  /** POST (201). Viagem finalizada: 409; cancelada: só DONO (auditado). */
  criar<T extends TipoLancamento>(viagemId: number, tipo: T, dados: ContratoLancamento[T]['requisicao']): Observable<ContratoLancamento[T]['resposta']> {
    return this.http.post<ContratoLancamento[T]['resposta']>(this.url(viagemId, tipo), dados);
  }

  /** PUT /{id} (substituição integral). Encerrada: só DONO (auditado). */
  atualizar<T extends TipoLancamento>(viagemId: number, tipo: T, id: number, dados: ContratoLancamento[T]['requisicao']): Observable<ContratoLancamento[T]['resposta']> {
    return this.http.put<ContratoLancamento[T]['resposta']>(this.url(viagemId, tipo, id), dados);
  }

  /** DELETE /{id} (204). Viagem encerrada: 409 para todos. */
  excluir(viagemId: number, tipo: TipoLancamento, id: number): Observable<void> {
    return this.http.delete<void>(this.url(viagemId, tipo, id));
  }
}
