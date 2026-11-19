import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { MotoristasModule } from '../motoristas.module';
import { DadosFormularioMotorista, MotoristaFormularioComponent } from './motorista-formulario.component';
import { AvisoService } from '../../../compartilhado/aviso.service';
import { JanelasService } from '../../../compartilhado/janela/janelas.service';
import { CAMINHOES_DONO_MOCK } from '../../../../testes/dados/caminhoes.mock';
import { MOTORISTAS_MOCK } from '../../../../testes/dados/motoristas.mock';
import { todos } from '../../../../testes/sessao-de-teste';

describe('MotoristaFormularioComponent', () => {
  let aviso: jasmine.SpyObj<AvisoService>;
  let janelas: jasmine.SpyObj<JanelasService>;
  let fechar: jasmine.Spy;
  let controle: HttpTestingController;

  afterEach(() => controle?.verify());

  function criar(dados: DadosFormularioMotorista, confirmar = true) {
    aviso = jasmine.createSpyObj<AvisoService>('AvisoService', ['falha', 'mostrar']);
    janelas = jasmine.createSpyObj<JanelasService>('JanelasService', ['abrir']);
    janelas.abrir.and.returnValue({ afterClosed: () => of(confirmar) } as never);
    fechar = jasmine.createSpy('close');
    TestBed.configureTestingModule({
      imports: [MotoristasModule],
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: dados },
        { provide: MatDialogRef, useValue: { close: fechar } },
        { provide: AvisoService, useValue: aviso },
        { provide: JanelasService, useValue: janelas }
      ]
    });
    controle = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(MotoristaFormularioComponent);
    fixture.detectChanges();
    return fixture;
  }

  const motorista = (id: number) => MOTORISTAS_MOCK.find(m => m.id === id)!;

  describe('novo motorista', () => {
    it('exige nome e e-mail válido; caminhões são opcionais', () => {
      const { componentInstance: c } = criar({ motorista: null, caminhoes: CAMINHOES_DONO_MOCK });
      expect(c.formulario.controls.nome.hasError('required')).toBeTrue();
      expect(c.formulario.controls.email.hasError('required')).toBeTrue();
      c.formulario.controls.email.setValue('sem-arroba');
      expect(c.formulario.controls.email.hasError('email')).toBeTrue();
      c.formulario.patchValue({ nome: 'Ana', email: 'ana@exemplo.com' });
      expect(c.formulario.valid).toBeTrue();
      c.formulario.controls.email.setValue('');
      c.salvar();
      controle.expectNone('/api/motoristas');
    });

    it('não oferece campos pessoais nem senha', () => {
      const fixture = criar({ motorista: null, caminhoes: CAMINHOES_DONO_MOCK });
      const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(fixture.nativeElement.querySelector('input[type="password"]')).toBeNull();
      ['CPF', 'CNH', 'Telefone', 'Endereço'].forEach(campo => expect(texto).not.toContain(campo));
    });

    it('oferece só caminhões não excluídos e envia POST /api/motoristas com a seleção', () => {
      const fixture = criar({ motorista: null, caminhoes: CAMINHOES_DONO_MOCK });
      const el: HTMLElement = fixture.nativeElement;
      const oferecidos = todos(el, 'input[data-caminhao-id]').map(i => Number(i.getAttribute('data-caminhao-id')));
      expect(oferecidos).toEqual([1, 3, 2]);
      (el.querySelector('input[data-caminhao-id="1"]') as HTMLInputElement).click();
      (el.querySelector('input[data-caminhao-id="3"]') as HTMLInputElement).click();
      (el.querySelector('input[data-caminhao-id="1"]') as HTMLInputElement).click();
      fixture.detectChanges();
      const c = fixture.componentInstance;
      c.formulario.patchValue({ nome: ' Ana ', email: 'ana@exemplo.com' });
      c.salvar();
      const req = controle.expectOne('/api/motoristas');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ nome: 'Ana', email: 'ana@exemplo.com', caminhaoIds: [3] });
      req.flush({ ...motorista(33), id: 40 }, { status: 201, statusText: 'Created' });
      expect(fechar).toHaveBeenCalledWith(true);
      expect(aviso.mostrar).toHaveBeenCalledWith('Convite enviado para ana@exemplo.com.');
    });

    it('503 (e-mail não configurado): mostra a mensagem e não fecha (nada foi gravado)', () => {
      const fixture = criar({ motorista: null, caminhoes: CAMINHOES_DONO_MOCK });
      fixture.componentInstance.formulario.patchValue({ nome: 'Ana', email: 'ana@exemplo.com' });
      fixture.componentInstance.salvar();
      controle.expectOne('/api/motoristas').flush(
        { status: 503, erro: 'Serviço indisponível', detalhes: ['Envio de e-mail não configurado no servidor.'] },
        { status: 503, statusText: 'Service Unavailable' });
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Envio de e-mail não configurado');
      expect(fechar).not.toHaveBeenCalled();
    });

    it('409 (e-mail já existe) mostra a mensagem do servidor', () => {
      const fixture = criar({ motorista: null, caminhoes: CAMINHOES_DONO_MOCK });
      fixture.componentInstance.formulario.patchValue({ nome: 'Ana', email: 'ana@exemplo.com' });
      fixture.componentInstance.salvar();
      controle.expectOne('/api/motoristas').flush(
        { status: 409, erro: 'Conflito de dados', detalhes: ['E-mail já cadastrado.'] }, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('E-mail já cadastrado.');
    });
  });

  describe('edição', () => {
    it('não permite alterar o e-mail', () => {
      const { componentInstance: c } = criar({ motorista: motorista(31), caminhoes: CAMINHOES_DONO_MOCK });
      expect(c.formulario.controls.email.disabled).toBeTrue();
    });

    it('conta com convite pendente não pode ser ativada (PUT com ativo=false)', () => {
      const fixture = criar({ motorista: motorista(33), caminhoes: CAMINHOES_DONO_MOCK });
      const c = fixture.componentInstance;
      expect(c.formulario.controls.ativo.disabled).toBeTrue();
      expect(fixture.nativeElement.querySelector('input[formcontrolname="ativo"]')).toBeNull();
      c.salvar();
      const req = controle.expectOne('/api/motoristas/33');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ nome: 'João Pereira', ativo: false });
      req.flush(motorista(33));
    });

    it('desativar conta ativa pede confirmação e então faz o PUT', () => {
      const { componentInstance: c } = criar({ motorista: motorista(31), caminhoes: CAMINHOES_DONO_MOCK });
      c.formulario.controls.ativo.setValue(false);
      c.salvar();
      expect(janelas.abrir).toHaveBeenCalled();
      const req = controle.expectOne('/api/motoristas/31');
      expect(req.request.body).toEqual({ nome: 'Carlos Lima', ativo: false });
      req.flush({ ...motorista(31), situacao: 'INATIVO' });
      expect(fechar).toHaveBeenCalledWith(true);
    });

    it('desativação não confirmada não chama a API', () => {
      const { componentInstance: c } = criar({ motorista: motorista(31), caminhoes: CAMINHOES_DONO_MOCK }, false);
      c.formulario.controls.ativo.setValue(false);
      c.salvar();
      controle.expectNone('/api/motoristas/31');
    });

    it('reativar conta inativa não pede confirmação', () => {
      const { componentInstance: c } = criar({ motorista: motorista(32), caminhoes: CAMINHOES_DONO_MOCK });
      c.formulario.controls.ativo.setValue(true);
      c.salvar();
      expect(janelas.abrir).not.toHaveBeenCalled();
      const req = controle.expectOne('/api/motoristas/32');
      expect(req.request.body).toEqual({ nome: 'Marcos Souza', ativo: true });
      req.flush({ ...motorista(32), situacao: 'ATIVO' });
    });
  });
});
