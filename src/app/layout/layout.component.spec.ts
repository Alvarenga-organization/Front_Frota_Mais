import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SessaoService } from '../core/sessao/sessao.service';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { LayoutModule } from './layout.module';
import { LayoutComponent } from './layout.component';
import { entrarComo, limparSessao, todos } from '../../testes/sessao-de-teste';

describe('LayoutComponent (menu por perfil)', () => {
  beforeEach(async () => {
    limparSessao();
    await TestBed.configureTestingModule({
      imports: [LayoutModule],
      providers: [provideRouter([]), provideNoopAnimations(), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
  });

  afterEach(() => limparSessao());

  function rotulosDoMenu(): string[] {
    const fixture = TestBed.createComponent(LayoutComponent);
    fixture.detectChanges();
    return todos(fixture.nativeElement, 'mat-nav-list a').map(a => a.textContent?.trim() ?? '');
  }

  it('DONO vê Motoristas e as telas de gestão', () => {
    entrarComo('DONO');
    expect(rotulosDoMenu()).toEqual(['Dashboard', 'Caminhões', 'Motoristas', 'Viagens', 'Relatórios', 'Manutenções']);
  });

  it('MOTORISTA vê só Caminhões e Viagens', () => {
    entrarComo('MOTORISTA');
    expect(rotulosDoMenu()).toEqual(['Caminhões', 'Viagens']);
  });

  it('Sair: limpa a sessão no cliente (sem chamar o servidor) e vai ao login', () => {
    const sessao = entrarComo('DONO');
    const router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    const fixture = TestBed.createComponent(LayoutComponent);
    fixture.detectChanges();
    fixture.componentInstance.sair();
    expect(sessao.sessao()).toBeNull();
    expect(sessionStorage.length).toBe(0);
    expect(TestBed.inject(SessaoService).token()).toBeNull();
    TestBed.inject(HttpTestingController).expectNone(() => true);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });
});
