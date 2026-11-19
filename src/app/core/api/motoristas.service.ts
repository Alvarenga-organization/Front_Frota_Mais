import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { MotoristaAtualizacaoRequest, MotoristaRequest, MotoristaResponse, VinculosRequest } from '../modelos/api.modelos';
import { API_URL } from '../http/api.config';

/**
 * Motoristas e convites (`/api/motoristas`), só DONO (MOTORISTA recebe 403).
 * O DONO não aparece na lista. Não existe exclusão de motorista: desativa-se.
 */
@Injectable({ providedIn: 'root' })
export class MotoristasService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/motoristas`;

  /** GET, ordenado por nome. */
  listar(): Observable<MotoristaResponse[]> {
    return this.http.get<MotoristaResponse[]>(this.url);
  }

  obter(id: number): Observable<MotoristaResponse> {
    return this.http.get<MotoristaResponse>(`${this.url}/${id}`);
  }

  /** POST (201): cadastra e envia o convite por e-mail. `503` = e-mail não configurado (nada é gravado). */
  convidar(dados: MotoristaRequest): Observable<MotoristaResponse> {
    return this.http.post<MotoristaResponse>(this.url, dados);
  }

  /** PUT (substituição integral; o e-mail não muda). `409` = ativar conta com convite pendente. */
  atualizar(id: number, dados: MotoristaAtualizacaoRequest): Observable<MotoristaResponse> {
    return this.http.put<MotoristaResponse>(`${this.url}/${id}`, dados);
  }

  /** PUT .../caminhoes com a lista **completa** (vazia remove todos). `409` = caminhão excluído. */
  vincular(id: number, dados: VinculosRequest): Observable<MotoristaResponse> {
    return this.http.put<MotoristaResponse>(`${this.url}/${id}/caminhoes`, dados);
  }

  /**
   * POST .../convite (200): reenvia e invalida o anterior. `409` = conta já ativada; `503` = sem e-mail.
   * O corpo da resposta não é usado (a tela recarrega a lista).
   */
  reenviarConvite(id: number): Observable<void> {
    return this.http.post(`${this.url}/${id}/convite`, null).pipe(map(() => undefined));
  }

  /** DELETE .../convite (200): cancela o convite pendente. `409` = conta ativada ou sem convite pendente. */
  cancelarConvite(id: number): Observable<void> {
    return this.http.delete(`${this.url}/${id}/convite`).pipe(map(() => undefined));
  }
}
