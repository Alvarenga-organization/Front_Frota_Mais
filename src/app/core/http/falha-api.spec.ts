import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { normalizarFalha } from './falha-api';

function resposta(status: number, error: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error, headers: new HttpHeaders(), url: '/api/x' });
}

describe('normalizarFalha', () => {
  it('usa o corpo padrão do back-end { status, erro, detalhes }', () => {
    const falha = normalizarFalha(resposta(409, { status: 409, erro: 'Conflito de dados', detalhes: ['Placa já cadastrada.'] }));
    expect(falha).toEqual({ status: 409, erro: 'Conflito de dados', detalhes: ['Placa já cadastrada.'] });
  });

  it('sem resposta do servidor (status 0) informa falha de conexão', () => {
    const falha = normalizarFalha(new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') }));
    expect(falha.status).toBe(0);
    expect(falha.erro).toBe('Sem conexão');
    expect(falha.detalhes[0]).toContain('Não foi possível falar com o servidor');
  });

  it('não repassa HTML nem texto cru (ex.: página de erro do proxy)', () => {
    const falha = normalizarFalha(resposta(504, '<html><body>Gateway Timeout</body></html>'));
    expect(falha.detalhes.join(' ')).not.toContain('<html>');
    expect(falha.detalhes[0]).toContain('não respondeu corretamente');
  });

  it('500 em texto puro (proxy de desenvolvimento sem back-end) não é tratado como erro da aplicação', () => {
    const falha = normalizarFalha(resposta(500, 'Internal Server Error'));
    expect(falha.erro).toBe('Servidor indisponível');
    expect(falha.detalhes[0]).toContain('fora do ar');
  });

  it('500 nunca expõe detalhes internos, mesmo se vierem no corpo', () => {
    const falha = normalizarFalha(resposta(500, { status: 500, erro: 'Erro interno', detalhes: ['NullPointerException at ...'] }));
    expect(falha.detalhes.join(' ')).not.toContain('NullPointer');
    expect(falha.detalhes[0]).toContain('Erro interno no servidor');
  });

  it('503 mostra a mensagem do servidor (ex.: envio de e-mail não configurado)', () => {
    const falha = normalizarFalha(resposta(503, { status: 503, erro: 'Serviço indisponível', detalhes: ['Envio de e-mail não configurado.'] }));
    expect(falha.detalhes).toEqual(['Envio de e-mail não configurado.']);
  });

  it('descarta itens que não são texto em detalhes', () => {
    const falha = normalizarFalha(resposta(400, { status: 400, erro: 'Dados inválidos', detalhes: ['placa: obrigatória', 42, null, ' '] }));
    expect(falha.detalhes).toEqual(['placa: obrigatória']);
  });

  it('429 e 403 sem corpo recebem mensagens padrão por status', () => {
    expect(normalizarFalha(resposta(429, null)).detalhes[0]).toContain('Muitas tentativas');
    expect(normalizarFalha(resposta(403, null)).detalhes[0]).toContain('permissão');
  });

  it('erro que não é HTTP vira "erro inesperado"', () => {
    expect(normalizarFalha(new Error('x')).status).toBe(-1);
  });
});
