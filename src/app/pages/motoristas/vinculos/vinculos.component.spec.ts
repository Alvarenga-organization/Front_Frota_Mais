import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MotoristasModule } from '../motoristas.module';
import { DadosVinculos, VinculosComponent } from './vinculos.component';
import { AvisoService } from '../../../compartilhado/aviso.service';
import { CAMINHOES_DONO_MOCK } from '../../../../testes/dados/caminhoes.mock';
import { MOTORISTAS_MOCK } from '../../../../testes/dados/motoristas.mock';

describe('VinculosComponent', () => {
  let controle: HttpTestingController;
  let fechar: jasmine.Spy;

  afterEach(() => controle.verify());

  function criar(motoristaId: number) {
    const dados: DadosVinculos = { motorista: MOTORISTAS_MOCK.find(m => m.id === motoristaId)!, caminhoes: CAMINHOES_DONO_MOCK };
    fechar = jasmine.createSpy('close');
    TestBed.configureTestingModule({
      imports: [MotoristasModule],
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: dados },
        { provide: MatDialogRef, useValue: { close: fechar } },
        { provide: AvisoService, useValue: jasmine.createSpyObj('AvisoService', ['falha', 'mostrar']) }
      ]
    });
    controle = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(VinculosComponent);
    fixture.detectChanges();
    return fixture;
  }

  function salvarEsperando(fixture: ReturnType<typeof criar>, motoristaId: number, caminhaoIds: number[]) {
    fixture.componentInstance.salvar();
    const req = controle.expectOne(`/api/motoristas/${motoristaId}/caminhoes`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ caminhaoIds });
    return req;
  }

  it('começa com os vínculos atuais marcados', () => {
    const fixture = criar(31);
    expect(fixture.componentInstance.selecao.value).toEqual([1]);
    const marcados = Array.from(fixture.nativeElement.querySelectorAll('input[data-caminhao-id]:checked'))
      .map(i => (i as HTMLInputElement).getAttribute('data-caminhao-id'));
    expect(marcados).toEqual(['1']);
  });

  it('envia a lista completa, não só o que mudou, e fecha com sucesso', () => {
    const fixture = criar(31);
    (fixture.nativeElement.querySelector('input[data-caminhao-id="2"]') as HTMLInputElement).click();
    salvarEsperando(fixture, 31, [1, 2]).flush(MOTORISTAS_MOCK[0]);
    expect(fechar).toHaveBeenCalledWith(true);
  });

  it('desmarcar tudo envia lista vazia (remove todos os vínculos)', () => {
    const fixture = criar(31);
    (fixture.nativeElement.querySelector('input[data-caminhao-id="1"]') as HTMLInputElement).click();
    salvarEsperando(fixture, 31, []).flush(MOTORISTAS_MOCK[0]);
  });

  it('avisa e retira do envio o vínculo com caminhão excluído', () => {
    const fixture = criar(32);
    expect(fixture.nativeElement.textContent).toContain('DEM0A01');
    expect(fixture.componentInstance.selecao.value).toEqual([3]);
    salvarEsperando(fixture, 32, [3]).flush(MOTORISTAS_MOCK[3]);
  });

  it('409 (caminhão excluído nesse meio-tempo) mostra a mensagem e não fecha', () => {
    const fixture = criar(31);
    salvarEsperando(fixture, 31, [1]).flush(
      { status: 409, erro: 'Conflito de dados', detalhes: ['Caminhão excluído não pode ser vinculado.'] },
      { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Caminhão excluído não pode ser vinculado.');
    expect(fechar).not.toHaveBeenCalled();
  });
});
