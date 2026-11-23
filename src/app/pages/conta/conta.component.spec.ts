import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ContaModule } from './conta.module';
import { ContaComponent } from './conta.component';
import { entrarComo, limparSessao } from '../../../testes/sessao-de-teste';

describe('ContaComponent (troca de senha)', () => {
  let controle: HttpTestingController;

  function criar() {
    TestBed.configureTestingModule({ imports: [ContaModule], providers: [provideHttpClient(), provideHttpClientTesting()] });
    controle = TestBed.inject(HttpTestingController);
    const sessao = entrarComo('MOTORISTA');
    const fixture = TestBed.createComponent(ContaComponent);
    fixture.detectChanges();
    fixture.componentInstance.formulario.setValue({ senhaAtual: 'senhaVelha1', novaSenha: 'senhaNova2', confirmacao: 'senhaNova2' });
    return { fixture, sessao };
  }

  beforeEach(() => limparSessao());
  afterEach(() => {
    controle.verify();
    limparSessao();
  });

  it('204: confirma a troca e limpa o formulário', () => {
    const { fixture } = criar();
    fixture.componentInstance.trocarSenha();
    const req = controle.expectOne('/api/auth/senha');
    expect(req.request.body).toEqual({ senhaAtual: 'senhaVelha1', novaSenha: 'senhaNova2' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Senha alterada.');
    expect(fixture.componentInstance.formulario.controls.senhaAtual.value).toBe('');
  });

  it('400 (senha atual incorreta): mostra a mensagem e NÃO desloga', () => {
    const { fixture, sessao } = criar();
    fixture.componentInstance.trocarSenha();
    controle.expectOne('/api/auth/senha').flush(
      { status: 400, erro: 'Dados inválidos', detalhes: ['Senha atual incorreta.'] }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Senha atual incorreta.');
    expect(sessao.sessao()).not.toBeNull();
  });

  it('confirmação diferente não é enviada', () => {
    const { fixture } = criar();
    fixture.componentInstance.formulario.controls.confirmacao.setValue('outra1234');
    fixture.componentInstance.trocarSenha();
    controle.expectNone('/api/auth/senha');
  });
});
