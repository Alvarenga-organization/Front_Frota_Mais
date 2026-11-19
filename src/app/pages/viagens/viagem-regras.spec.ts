import { acoesDaViagem, corpoAlteracao, faltasParaFinalizar, opcoesResponsavel, temFaltas } from './viagem-regras';
import { viagemEmAndamento, viagemFinalizada } from '../../../testes/dados/viagens.mock';
import { MOTORISTAS_MOCK } from '../../../testes/dados/motoristas.mock';

describe('Regras de apresentação da viagem', () => {
  describe('acoesDaViagem (espelho da matriz de permissões do contrato)', () => {
    it('em andamento: DONO e MOTORISTA editam, finalizam e lançam; só DONO cancela', () => {
      const dono = acoesDaViagem({ status: 'EM_ANDAMENTO' }, true);
      const motorista = acoesDaViagem({ status: 'EM_ANDAMENTO' }, false);
      expect(dono).toEqual(jasmine.objectContaining({ editar: true, finalizar: true, cancelar: true, incluirLancamento: true, excluirLancamento: true }));
      expect(motorista).toEqual(jasmine.objectContaining({ editar: true, finalizar: true, cancelar: false, incluirLancamento: true, auditoria: false }));
    });

    it('finalizada: só o DONO corrige viagem e lançamentos; ninguém inclui nem exclui', () => {
      expect(acoesDaViagem({ status: 'FINALIZADA' }, true)).toEqual({
        editar: false, corrigir: true, finalizar: false, cancelar: false,
        incluirLancamento: false, editarLancamento: true, excluirLancamento: false, auditoria: true
      });
      const motorista = acoesDaViagem({ status: 'FINALIZADA' }, false);
      expect(Object.values(motorista).some(Boolean)).toBeFalse();
    });

    it('cancelada: DONO inclui e corrige lançamentos (auditado); MOTORISTA só visualiza', () => {
      expect(acoesDaViagem({ status: 'CANCELADA' }, true)).toEqual(jasmine.objectContaining({ incluirLancamento: true, editarLancamento: true, excluirLancamento: false, finalizar: false, cancelar: false }));
      expect(Object.values(acoesDaViagem({ status: 'CANCELADA' }, false)).some(Boolean)).toBeFalse();
    });
  });

  it('faltasParaFinalizar aponta o que o PUT prévio precisa enviar', () => {
    const faltas = faltasParaFinalizar(viagemEmAndamento());
    expect(faltas).toEqual({ valorFrete: true, origem: false, destino: true, kmInicialCarregado: true });
    expect(temFaltas(faltas)).toBeTrue();
    expect(temFaltas(faltasParaFinalizar(viagemFinalizada()))).toBeFalse();
  });

  describe('corpoAlteracao (PUT integral)', () => {
    it('DONO: reenvia todos os campos e o motoristaId atual (ausente removeria o responsável)', () => {
      const corpo = corpoAlteracao(viagemEmAndamento(), { kmInicialCarregado: 10480 }, true);
      expect(corpo).toEqual({
        dataInicio: '2025-03-05', origem: 'São Paulo', destino: null, valorFrete: null, kmInicialVazio: 10400,
        kmInicialCarregado: 10480, consumoMedioVazio: '3.2', consumoMedioCarregado: null, dataFim: null,
        kmFinalCarregado: null, motoristaId: 31
      });
    });

    it('MOTORISTA: não envia motoristaId', () => {
      const corpo = corpoAlteracao(viagemEmAndamento(), {}, false);
      expect('motoristaId' in corpo).toBeFalse();
    });

    it('em andamento nunca envia dataFim/kmFinalCarregado (o servidor recusaria com 400)', () => {
      const corpo = corpoAlteracao(viagemEmAndamento(), { dataFim: '2025-03-07', kmFinalCarregado: 5 }, true);
      expect(corpo.dataFim).toBeNull();
      expect(corpo.kmFinalCarregado).toBeNull();
    });

    it('encerrada: mantém dataFim e kmFinalCarregado atuais', () => {
      const corpo = corpoAlteracao(viagemFinalizada(), { valorFrete: '3700.00' }, true);
      expect(corpo.dataFim).toBe('2025-03-07');
      expect(corpo.kmFinalCarregado).toBe(10980);
      expect(corpo.valorFrete).toBe('3700.00');
    });
  });

  it('opcoesResponsavel: ninguém, eu mesmo e só motoristas ATIVOS vinculados ao caminhão', () => {
    const opcoes = opcoesResponsavel(1, MOTORISTAS_MOCK, 7);
    expect(opcoes.map(o => o.id)).toEqual([null, 7, 31]);
    expect(opcoesResponsavel(3, MOTORISTAS_MOCK, null).map(o => o.id)).toEqual([null]); // 32 está INATIVO
    expect(opcoesResponsavel(3, MOTORISTAS_MOCK, null, { id: 32, nome: 'Marcos' }).map(o => o.rotulo)).toEqual(['Ninguém', 'Marcos (atual)']);
  });
});
