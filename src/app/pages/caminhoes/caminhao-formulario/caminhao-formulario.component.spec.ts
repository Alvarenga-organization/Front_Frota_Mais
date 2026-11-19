import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CaminhoesModule } from '../caminhoes.module';
import { CaminhaoFormularioComponent, DadosFormularioCaminhao } from './caminhao-formulario.component';
import { paraCaminhaoRequest, valoresIniciaisCaminhao } from './caminhao-formulario';
import { AvisoService } from '../../../compartilhado/aviso.service';
import { CAMINHOES_DONO_MOCK } from '../../../../testes/dados/caminhoes.mock';

describe('CaminhaoFormularioComponent', () => {
  let aviso: jasmine.SpyObj<AvisoService>;
  let fechar: jasmine.Spy;
  let controle: HttpTestingController;

  afterEach(() => controle?.verify());

  function criar(dados: DadosFormularioCaminhao) {
    aviso = jasmine.createSpyObj<AvisoService>('AvisoService', ['falha', 'mostrar']);
    fechar = jasmine.createSpy('close');
    TestBed.configureTestingModule({
      imports: [CaminhoesModule],
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: dados },
        { provide: MatDialogRef, useValue: { close: fechar } },
        { provide: AvisoService, useValue: aviso }
      ]
    });
    controle = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CaminhaoFormularioComponent);
    fixture.detectChanges();
    return fixture;
  }

  function preencherValido(componente: CaminhaoFormularioComponent): void {
    componente.formulario.setValue({
      placa: 'abc-1d23', marca: 'Volvo', modelo: 'FH 540', ano: 2022, eixos: 6,
      capacidadeTanqueLitros: null, status: 'ATIVO'
    });
  }

  it('exige placa, marca, modelo, ano e eixos; tanque é opcional', () => {
    const { componentInstance: c } = criar({ modo: 'novo', caminhao: null });
    const controles = c.formulario.controls;
    expect(controles.placa.hasError('required')).toBeTrue();
    expect(controles.marca.hasError('required')).toBeTrue();
    expect(controles.modelo.hasError('required')).toBeTrue();
    expect(controles.ano.hasError('required')).toBeTrue();
    expect(controles.eixos.hasError('required')).toBeTrue();
    expect(controles.capacidadeTanqueLitros.valid).toBeTrue();
  });

  it('respeita os limites do contrato (eixos 1–20, ano 1950–2100, placa até 8 letras/números)', () => {
    const { componentInstance: c } = criar({ modo: 'novo', caminhao: null });
    const { eixos, ano, placa, capacidadeTanqueLitros } = c.formulario.controls;
    eixos.setValue(0); expect(eixos.valid).toBeFalse();
    eixos.setValue(21); expect(eixos.valid).toBeFalse();
    eixos.setValue(2.5); expect(eixos.hasError('inteiro')).toBeTrue();
    eixos.setValue(20); expect(eixos.valid).toBeTrue();
    ano.setValue(1949); expect(ano.valid).toBeFalse();
    ano.setValue(2101); expect(ano.valid).toBeFalse();
    placa.setValue('ABC-1D2345'); expect(placa.hasError('placaInvalida')).toBeTrue(); // 9 após normalizar
    placa.setValue('ABC-1D234'); expect(placa.valid).toBeTrue(); // 8 após normalizar: limite aceito
    placa.setValue('---'); expect(placa.hasError('placaInvalida')).toBeTrue(); // nada sobra após normalizar
    placa.setValue('abc-1d23'); expect(placa.valid).toBeTrue();
    capacidadeTanqueLitros.setValue(0); expect(capacidadeTanqueLitros.valid).toBeFalse();
  });

  it('oferece só ATIVO e INATIVO no status (EXCLUIDO só pela exclusão)', () => {
    const fixture = criar({ modo: 'novo', caminhao: null });
    const opcoes = Array.from(fixture.nativeElement.querySelectorAll('#caminhao-status option')).map(o => (o as HTMLOptionElement).value);
    expect(opcoes).toEqual(['ATIVO', 'INATIVO']);
  });

  it('não envia nada com o formulário inválido', () => {
    const { componentInstance: c } = criar({ modo: 'novo', caminhao: null });
    c.salvar();
    controle.expectNone('/api/caminhoes');
  });

  it('novo: POST /api/caminhoes com o CaminhaoRequest e fecha a janela com sucesso', () => {
    const fixture = criar({ modo: 'novo', caminhao: null });
    preencherValido(fixture.componentInstance);
    fixture.componentInstance.salvar();
    const req = controle.expectOne('/api/caminhoes');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      placa: 'abc-1d23', marca: 'Volvo', modelo: 'FH 540', ano: 2022, eixos: 6, status: 'ATIVO', capacidadeTanqueLitros: null
    });
    req.flush({ ...CAMINHOES_DONO_MOCK[0], placa: 'ABC1D23' }, { status: 201, statusText: 'Created' });
    expect(fechar).toHaveBeenCalledWith(true);
    expect(aviso.mostrar).toHaveBeenCalledWith('Caminhão ABC1D23 cadastrado.');
  });

  it('409 (placa duplicada): mostra a mensagem do servidor e mantém a janela aberta', () => {
    const fixture = criar({ modo: 'novo', caminhao: null });
    preencherValido(fixture.componentInstance);
    fixture.componentInstance.salvar();
    controle.expectOne('/api/caminhoes').flush(
      { status: 409, erro: 'Conflito de dados', detalhes: ['Já existe um caminhão com esta placa.'] }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Já existe um caminhão com esta placa.');
    expect(fechar).not.toHaveBeenCalled();
    expect(fixture.componentInstance.enviando()).toBeFalse();
  });

  it('impede envio duplicado durante a requisição', () => {
    const fixture = criar({ modo: 'novo', caminhao: null });
    preencherValido(fixture.componentInstance);
    fixture.componentInstance.salvar();
    fixture.componentInstance.salvar();
    controle.expectOne('/api/caminhoes').flush(CAMINHOES_DONO_MOCK[0], { status: 201, statusText: 'Created' });
  });

  it('edição: PUT /api/caminhoes/{id} com todos os campos e o status', () => {
    const caminhao = CAMINHOES_DONO_MOCK.find(c => c.placa === 'QIT2E40')!;
    const fixture = criar({ modo: 'editar', caminhao });
    fixture.componentInstance.formulario.controls.modelo.setValue('R450');
    fixture.componentInstance.salvar();
    const req = controle.expectOne(`/api/caminhoes/${caminhao.id}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ ...paraCaminhaoRequest(valoresIniciaisCaminhao(caminhao)), modelo: 'R450' });
    expect(req.request.body.status).toBeDefined();
    req.flush(caminhao);
    expect(fechar).toHaveBeenCalledWith(true);
  });

  it('na edição pré-preenche todos os campos atuais (PUT integral)', () => {
    const caminhao = CAMINHOES_DONO_MOCK.find(c => c.placa === 'QIT2E40')!;
    const { componentInstance: c } = criar({ modo: 'editar', caminhao });
    expect(c.formulario.getRawValue()).toEqual(valoresIniciaisCaminhao(caminhao));
    expect(paraCaminhaoRequest(valoresIniciaisCaminhao(caminhao)).capacidadeTanqueLitros).toBe(700);
  });

  it('caminhão antigo sem marca/eixos avisa e exige completar antes de salvar', () => {
    const caminhao = CAMINHOES_DONO_MOCK.find(c => c.placa === 'DEM1B22')!;
    const fixture = criar({ modo: 'editar', caminhao, statusSugerido: 'ATIVO' });
    expect(fixture.nativeElement.textContent).toContain('sem marca ou eixos');
    expect(fixture.componentInstance.formulario.controls.status.value).toBe('ATIVO');
    expect(fixture.componentInstance.formulario.valid).toBeFalse();
  });

  it('em visualização fica somente leitura e sem botão de salvar', () => {
    const caminhao = CAMINHOES_DONO_MOCK[0];
    const fixture = criar({ modo: 'visualizar', caminhao });
    expect(fixture.componentInstance.formulario.disabled).toBeTrue();
    expect(fixture.nativeElement.querySelector('button[type="submit"]')).toBeNull();
  });
});
