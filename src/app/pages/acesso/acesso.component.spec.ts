import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { AcessoModule } from './acesso.module';
import { LoginComponent } from './login/login.component';
import { CriarContaComponent } from './criar-conta/criar-conta.component';
import { AtivarContaComponent } from './ativar-conta/ativar-conta.component';
import { SessaoService } from '../../core/sessao/sessao.service';
import { limparSessao, tokenDeTeste } from '../../../testes/sessao-de-teste';

const ERRO_401 = { status: 401, statusText: 'Unauthorized' };

describe('Telas de acesso', () => {
  let controle: HttpTestingController;
  let router: Router;

  function configurar(queryParams: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [AcessoModule],
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } } }
      ]
    });
    controle = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    spyOn(router, 'navigate').and.resolveTo(true);
  }

  beforeEach(() => limparSessao());
  afterEach(() => {
    controle.verify();
    limparSessao();
  });

  describe('LoginComponent', () => {
    function criar() {
      configurar();
      const fixture = TestBed.createComponent(LoginComponent);
      fixture.detectChanges();
      return fixture;
    }

    it('formulário inválido não chama a API', () => {
      const fixture = criar();
      fixture.componentInstance.entrar();
      controle.expectNone('/api/auth/login');
    });

    it('não oferece mais o modo demonstração', () => {
      const fixture = criar();
      expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('demonstração');
    });

    it('entra, abre a sessão e vai ao início', () => {
      const fixture = criar();
      fixture.componentInstance.formulario.setValue({ email: 'ana@exemplo.com', senha: 'senhaForte1' });
      fixture.componentInstance.entrar();
      const req = controle.expectOne('/api/auth/login');
      expect(req.request.body.email).toBe('ana@exemplo.com');
      req.flush({ token: tokenDeTeste(1), nome: 'Ana', perfil: 'DONO' });
      expect(TestBed.inject(SessaoService).ehDono()).toBeTrue();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/inicio');
    });

    it('401: mostra a mensagem do servidor, limpa a senha e não navega', () => {
      const fixture = criar();
      fixture.componentInstance.formulario.setValue({ email: 'ana@exemplo.com', senha: 'errada123' });
      fixture.componentInstance.entrar();
      controle.expectOne('/api/auth/login').flush({ status: 401, erro: 'Não autenticado', detalhes: ['E-mail ou senha inválidos.'] }, ERRO_401);
      fixture.detectChanges();
      const alerta = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
      expect(alerta.textContent).toContain('E-mail ou senha inválidos.');
      expect(fixture.componentInstance.formulario.controls.senha.value).toBe('');
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('impede envio duplicado enquanto a requisição está em andamento', () => {
      const fixture = criar();
      fixture.componentInstance.formulario.setValue({ email: 'ana@exemplo.com', senha: 'senhaForte1' });
      fixture.componentInstance.entrar();
      fixture.componentInstance.entrar();
      fixture.detectChanges();
      expect((fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBeTrue();
      controle.expectOne('/api/auth/login').flush({ token: tokenDeTeste(1), nome: 'Ana', perfil: 'DONO' });
    });

    it('falha de conexão mostra mensagem e permite tentar de novo', () => {
      const fixture = criar();
      fixture.componentInstance.formulario.setValue({ email: 'ana@exemplo.com', senha: 'senhaForte1' });
      fixture.componentInstance.entrar();
      controle.expectOne('/api/auth/login').error(new ProgressEvent('error'), { status: 0 });
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Não foi possível falar com o servidor');
      expect(fixture.componentInstance.enviando()).toBeFalse();
    });

    it('mostra aviso quando a sessão anterior foi encerrada', () => {
      configurar();
      TestBed.inject(SessaoService).encerrar('expirada');
      const fixture = TestBed.createComponent(LoginComponent);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Sua sessão foi encerrada');
    });
  });

  describe('CriarContaComponent', () => {
    function preencher(c: CriarContaComponent) {
      c.formulario.setValue({ nomeEmpresa: 'Transportes X', nome: 'Ana', email: 'ana@exemplo.com', senha: 'senhaForte1' });
    }

    it('senha fraca não é enviada', () => {
      configurar();
      const fixture = TestBed.createComponent(CriarContaComponent);
      preencher(fixture.componentInstance);
      fixture.componentInstance.formulario.controls.senha.setValue('semnumero');
      fixture.componentInstance.criar();
      controle.expectNone('/api/auth/registro');
    });

    it('registra e entra direto', () => {
      configurar();
      const fixture = TestBed.createComponent(CriarContaComponent);
      preencher(fixture.componentInstance);
      fixture.componentInstance.criar();
      controle.expectOne('/api/auth/registro').flush({ token: tokenDeTeste(1), nome: 'Ana', perfil: 'DONO' }, { status: 201, statusText: 'Created' });
      expect(router.navigateByUrl).toHaveBeenCalledWith('/inicio');
    });

    it('409: mostra "E-mail já cadastrado."', () => {
      configurar();
      const fixture = TestBed.createComponent(CriarContaComponent);
      preencher(fixture.componentInstance);
      fixture.componentInstance.criar();
      controle.expectOne('/api/auth/registro').flush(
        { status: 409, erro: 'Conflito de dados', detalhes: ['E-mail já cadastrado.'] }, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('E-mail já cadastrado.');
      expect(TestBed.inject(SessaoService).sessao()).toBeNull();
    });
  });

  describe('AtivarContaComponent', () => {
    it('lê o token, retira-o da URL e ativa a conta', () => {
      configurar({ token: 'convite-123' });
      const fixture = TestBed.createComponent(AtivarContaComponent);
      fixture.detectChanges();
      expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: {}, replaceUrl: true }));
      fixture.componentInstance.formulario.setValue({ senha: 'minhaSenha1', confirmacao: 'minhaSenha1' });
      fixture.componentInstance.ativar();
      const req = controle.expectOne('/api/convites/ativacao');
      expect(req.request.body).toEqual({ token: 'convite-123', senha: 'minhaSenha1' });
      req.flush({ token: tokenDeTeste(31), nome: 'Carlos', perfil: 'MOTORISTA' });
      expect(TestBed.inject(SessaoService).perfil()).toBe('MOTORISTA');
      expect(router.navigateByUrl).toHaveBeenCalledWith('/inicio');
    });

    it('400 (convite inválido): mostra a mensagem do servidor e não navega', () => {
      configurar({ token: 'convite-velho' });
      const fixture = TestBed.createComponent(AtivarContaComponent);
      fixture.detectChanges();
      fixture.componentInstance.formulario.setValue({ senha: 'minhaSenha1', confirmacao: 'minhaSenha1' });
      fixture.componentInstance.ativar();
      controle.expectOne('/api/convites/ativacao').flush({
        status: 400, erro: 'Dados inválidos',
        detalhes: ['Convite inválido, já utilizado ou expirado. Peça um novo convite ao responsável.']
      }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Peça um novo convite');
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('sem token na URL: não mostra o formulário e não chama a API', () => {
      configurar();
      const fixture = TestBed.createComponent(AtivarContaComponent);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('form')).toBeNull();
      fixture.componentInstance.ativar();
      controle.expectNone('/api/convites/ativacao');
    });

    it('senhas diferentes não são enviadas', () => {
      configurar({ token: 'convite-123' });
      const fixture = TestBed.createComponent(AtivarContaComponent);
      fixture.detectChanges();
      fixture.componentInstance.formulario.setValue({ senha: 'minhaSenha1', confirmacao: 'outraSenha1' });
      fixture.componentInstance.ativar();
      controle.expectNone('/api/convites/ativacao');
    });
  });
});
