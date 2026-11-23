import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { ManutencaoModule } from './manutencao.module';
import { ManutencaoComponent } from './manutencao.component';
import { ManutencaoFormularioComponent } from './manutencao-formulario/manutencao-formulario.component';
import { ManutencoesService } from '../../core/api/manutencoes.service';
import { JanelasService } from '../../compartilhado/janela/janelas.service';
import { AvisoService } from '../../compartilhado/aviso.service';
import { ManutencaoResponse } from '../../core/modelos/api.modelos';
import { CAMINHOES_DONO_MOCK } from '../../../testes/dados/caminhoes.mock';
import { entrarComo, limparSessao } from '../../../testes/sessao-de-teste';

const EXCLUIDO = CAMINHOES_DONO_MOCK.find(c => c.status === 'EXCLUIDO')!;
const ATIVO = CAMINHOES_DONO_MOCK.find(c => c.status === 'ATIVO')!;

function manutencao(parcial: Partial<ManutencaoResponse> = {}): ManutencaoResponse {
  return { id: 44, caminhaoId: ATIVO.id, placa: ATIVO.placa, data: '2025-06-15', descricao: 'Troca de pneus', valor: 150,
    criadaEm: '2025-06-15T18:00:00Z', atualizadaEm: '2025-06-15T18:00:00Z', excluidaEm: null, ...parcial };
}

describe('Manutenções', () => {
  let controle: HttpTestingController;
  let janelas: jasmine.SpyObj<JanelasService>;
  let fechar: jasmine.Spy;

  function configurar(dadosJanela?: unknown) {
    limparSessao();
    janelas = jasmine.createSpyObj<JanelasService>('JanelasService', ['abrir']);
    janelas.abrir.and.returnValue({ afterClosed: () => of(true) } as never);
    fechar = jasmine.createSpy('close');
    TestBed.configureTestingModule({
      imports: [ManutencaoModule],
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: JanelasService, useValue: janelas },
        { provide: AvisoService, useValue: jasmine.createSpyObj('AvisoService', ['mostrar', 'falha']) },
        { provide: MAT_DIALOG_DATA, useValue: dadosJanela ?? null },
        { provide: MatDialogRef, useValue: { close: fechar } }
      ]
    });
    controle = TestBed.inject(HttpTestingController);
    entrarComo('DONO');
  }

  afterEach(() => {
    controle.verify();
    limparSessao();
  });

  describe('ManutencoesService', () => {
    it('envia só os filtros preenchidos e usa as rotas do contrato', () => {
      configurar();
      const servico = TestBed.inject(ManutencoesService);
      servico.listar({ caminhaoId: 1, de: '2025-06-01', ate: null, incluirExcluidas: false }).subscribe();
      const lista = controle.expectOne(r => r.url === '/api/manutencoes');
      expect(lista.request.params.keys().sort()).toEqual(['caminhaoId', 'de']);
      lista.flush([]);
      servico.criar({ caminhaoId: 1, data: '2025-06-15', descricao: 'Troca', valor: '150.00' }).subscribe();
      servico.atualizar(44, { caminhaoId: 1, data: '2025-06-15', descricao: 'Troca', valor: '150.00' }).subscribe();
      servico.excluir(44).subscribe();
      const reqs = controle.match(() => true);
      expect(reqs.map(r => `${r.request.method} ${r.request.url}`)).toEqual(['POST /api/manutencoes', 'PUT /api/manutencoes/44', 'DELETE /api/manutencoes/44']);
      reqs.forEach(r => r.flush(r.request.method === 'DELETE' ? null : manutencao()));
    });
  });

  describe('ManutencaoComponent', () => {
    function criar(lista: ManutencaoResponse[]): ComponentFixture<ManutencaoComponent> {
      const fixture = TestBed.createComponent(ManutencaoComponent);
      fixture.detectChanges();
      const caminhoes = controle.expectOne(r => r.url === '/api/caminhoes');
      expect(caminhoes.request.params.get('incluirExcluidos')).toBe('true');
      caminhoes.flush(CAMINHOES_DONO_MOCK);
      controle.expectOne(r => r.url === '/api/manutencoes').flush(lista);
      fixture.detectChanges();
      return fixture;
    }

    it('lista com placa e modelo; caminhão excluído e manutenção excluída ficam só para consulta', () => {
      configurar();
      const el: HTMLElement = criar([
        manutencao(),
        manutencao({ id: 45, caminhaoId: EXCLUIDO.id, placa: EXCLUIDO.placa }),
        manutencao({ id: 46, excluidaEm: '2025-06-20T10:00:00Z' })
      ]).nativeElement;
      expect(el.querySelector('[data-manutencao-id="44"]')!.textContent).toContain(ATIVO.modelo);
      expect(el.querySelector('[data-manutencao-id="44"] .acao-editar')).not.toBeNull();
      expect(el.querySelector('[data-manutencao-id="45"] .acao-editar')).toBeNull();
      expect(el.querySelector('[data-manutencao-id="46"]')!.textContent).toContain('Excluída');
      expect(el.querySelector('[data-manutencao-id="46"] .acao-excluir')).toBeNull();
    });

    it('filtro de período e "mostrar excluídas" consultam o servidor; 400 aparece como falha', () => {
      configurar();
      const fixture = criar([]);
      expect(fixture.componentInstance.estado()).toBe('vazio');
      fixture.componentInstance.filtrar('de', '2025-07-01');
      controle.expectOne(r => r.url === '/api/manutencoes').flush([]);
      fixture.componentInstance.filtrar('ate', '2025-06-01');
      const req = controle.expectOne(r => r.url === '/api/manutencoes');
      expect(req.request.params.get('de')).toBe('2025-07-01');
      expect(req.request.params.get('ate')).toBe('2025-06-01');
      req.flush({ status: 400, erro: 'Dados inválidos', detalhes: ['A data final não pode ser anterior à inicial.'] }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('A data final não pode ser anterior à inicial.');
      fixture.componentInstance.filtrar('excluidas', true);
      expect(controle.expectOne(r => r.url === '/api/manutencoes').request.params.get('incluirExcluidas')).toBe('true');
    });

    it('excluir: confirma, DELETE e recarrega', () => {
      configurar();
      const fixture = criar([manutencao()]);
      (fixture.nativeElement.querySelector('[data-manutencao-id="44"] .acao-excluir') as HTMLButtonElement).click();
      const req = controle.expectOne('/api/manutencoes/44');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });
      controle.expectOne(r => r.url === '/api/manutencoes').flush([]);
    });
  });

  describe('ManutencaoFormularioComponent', () => {
    it('não oferece caminhão excluído; descrição livre; valor convertido; POST', () => {
      configurar({ manutencao: null, caminhoes: CAMINHOES_DONO_MOCK });
      const fixture = TestBed.createComponent(ManutencaoFormularioComponent);
      fixture.detectChanges();
      const c = fixture.componentInstance;
      expect(c.caminhoes.some(cam => cam.status === 'EXCLUIDO')).toBeFalse();
      c.salvar();
      controle.expectNone('/api/manutencoes');
      c.formulario.patchValue({ caminhaoId: String(ATIVO.id), data: '2025-06-15', descricao: ' Troca de pneus ', valor: '1.500,00' });
      c.salvar();
      const req = controle.expectOne('/api/manutencoes');
      expect(req.request.body).toEqual({ caminhaoId: ATIVO.id, data: '2025-06-15', descricao: 'Troca de pneus', valor: '1500.00' });
      req.flush(manutencao(), { status: 201, statusText: 'Created' });
      expect(fechar).toHaveBeenCalledWith(true);
    });

    it('edição faz PUT; 409 (caminhão excluído) mostra a mensagem', () => {
      configurar({ manutencao: manutencao(), caminhoes: CAMINHOES_DONO_MOCK });
      const fixture = TestBed.createComponent(ManutencaoFormularioComponent);
      fixture.detectChanges();
      fixture.componentInstance.salvar();
      controle.expectOne('/api/manutencoes/44').flush(
        { status: 409, erro: 'Conflito de dados', detalhes: ['Caminhão excluído não recebe manutenção.'] }, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Caminhão excluído não recebe manutenção.');
      expect(fechar).not.toHaveBeenCalled();
    });
  });
});
