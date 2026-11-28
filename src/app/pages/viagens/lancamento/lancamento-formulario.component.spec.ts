import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ViagensModule } from '../viagens.module';
import { DadosLancamento, LancamentoFormularioComponent } from './lancamento-formulario.component';
import { AvisoService } from '../../../compartilhado/aviso.service';
import { AbastecimentoResponse, ViagemResponse } from '../../../core/modelos/api.modelos';
import { viagemEmAndamento } from '../../../../testes/dados/viagens.mock';
import { entrarComo, limparSessao } from '../../../../testes/sessao-de-teste';

/**
 * Envio **pelo DOM** (clique em "Salvar", que fica fora do <form> e usa `form="..."`),
 * não pela chamada direta de `salvar()`. Se o <form> perder o `[formGroup]`, o `ngSubmit`
 * não dispara, nenhuma requisição sai e o envio nativo recarregaria a página.
 */
/** Dados da janela sem a viagem (o padrão é `viagemEmAndamento()`). */
type SemViagem<T> = T extends unknown ? Omit<T, 'viagem'> & { viagem?: ViagemResponse } : never;

describe('LancamentoFormularioComponent (envio pelo formulário)', () => {
  let controle: HttpTestingController;
  let fechar: jasmine.Spy;

  function criar(dados: SemViagem<DadosLancamento>): ComponentFixture<LancamentoFormularioComponent> {
    limparSessao();
    fechar = jasmine.createSpy('close');
    TestBed.configureTestingModule({
      imports: [ViagensModule],
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { viagem: viagemEmAndamento(), ...dados } },
        { provide: MatDialogRef, useValue: { close: fechar } },
        { provide: AvisoService, useValue: jasmine.createSpyObj('AvisoService', ['mostrar', 'falha']) }
      ]
    });
    controle = TestBed.inject(HttpTestingController);
    entrarComo('MOTORISTA');
    const fixture = TestBed.createComponent(LancamentoFormularioComponent);
    fixture.detectChanges();
    return fixture;
  }

  function digitar(fixture: ComponentFixture<unknown>, seletor: string, valor: string): void {
    const campo = (fixture.nativeElement as HTMLElement).querySelector(seletor) as HTMLInputElement | HTMLSelectElement;
    expect(campo).withContext(seletor).not.toBeNull();
    campo.value = valor;
    campo.dispatchEvent(new Event(campo instanceof HTMLSelectElement ? 'change' : 'input'));
  }

  function campo(fixture: ComponentFixture<unknown>, sufixo: string): string {
    const el = (fixture.nativeElement as HTMLElement).querySelector(`[id$="${sufixo}"]`) as HTMLElement;
    return `#${el.id}`;
  }

  /** Clica em "Salvar" e devolve se o envio nativo foi impedido (sem recarregar a página). */
  function clicarSalvar(fixture: ComponentFixture<unknown>): boolean {
    const el = fixture.nativeElement as HTMLElement;
    const form = el.querySelector('#formulario-lancamento') as HTMLFormElement;
    let impedido = false;
    // Último ouvinte da fase de bolha: o Angular já tratou o evento.
    const ouvinte = (e: Event) => { impedido = e.defaultPrevented; e.preventDefault(); };
    form.addEventListener('submit', ouvinte);
    (el.querySelector('button[type="submit"][form="formulario-lancamento"]') as HTMLButtonElement).click();
    form.removeEventListener('submit', ouvinte);
    fixture.detectChanges();
    return impedido;
  }

  function preencherAbastecimento(fixture: ComponentFixture<unknown>, km: string): void {
    digitar(fixture, campo(fixture, '-data'), '2025-03-06');
    digitar(fixture, campo(fixture, '-km'), km);
    digitar(fixture, campo(fixture, '-litros'), '250,5');
    digitar(fixture, campo(fixture, '-valor'), '1.553,10');
  }

  afterEach(() => {
    controle.verify();
    limparSessao();
  });

  it('salva diesel pelo botão: sem recarregar e com o JSON exato do contrato 1.2 (sem "hora")', () => {
    const fixture = criar({ tipo: 'abastecimentos', combustivel: 'DIESEL' });
    preencherAbastecimento(fixture, '10450');
    expect(clicarSalvar(fixture)).toBeTrue();
    const req = controle.expectOne('/api/viagens/205/abastecimentos');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ tipo: 'DIESEL', data: '2025-03-06', quilometragem: 10450, litros: '250.5', valorTotal: '1553.10' });
    expect('hora' in req.request.body).toBeFalse();
    expect(typeof req.request.body.quilometragem).toBe('number');
    req.flush({ id: 1, tipo: 'DIESEL', data: '2025-03-06', quilometragem: 10450, hora: null, litros: 250.5, valorTotal: 1553.1 },
      { status: 201, statusText: 'Created' });
    expect(fechar).toHaveBeenCalledWith(true);
  });

  it('salva Arla pelo botão com a quilometragem', () => {
    const fixture = criar({ tipo: 'abastecimentos', combustivel: 'ARLA' });
    preencherAbastecimento(fixture, '0');
    expect(clicarSalvar(fixture)).toBeTrue();
    const req = controle.expectOne('/api/viagens/205/abastecimentos');
    expect(req.request.body).toEqual({ tipo: 'ARLA', data: '2025-03-06', quilometragem: 0, litros: '250.5', valorTotal: '1553.10' });
    req.flush({ id: 2, tipo: 'ARLA', data: '2025-03-06', quilometragem: 0, hora: null, litros: 250.5, valorTotal: 1553.1 });
  });

  it('salva pedágio pelo botão: só data e valor pago', () => {
    const fixture = criar({ tipo: 'pedagios' });
    digitar(fixture, '#pedagio-data', '2025-03-06');
    digitar(fixture, '#pedagio-valor', '40,10');
    expect(clicarSalvar(fixture)).toBeTrue();
    const req = controle.expectOne('/api/viagens/205/pedagios');
    expect(req.request.body).toEqual({ data: '2025-03-06', valor: '40.10' });
    req.flush({ id: 950, data: '2025-03-06', valor: 40.1 });
    expect(fechar).toHaveBeenCalledWith(true);
  });

  it('salva despesa extra pelo botão com descrição livre ("Alimentação")', () => {
    const fixture = criar({ tipo: 'despesas-extras' });
    digitar(fixture, '#despesa-descricao', 'Alimentação');
    digitar(fixture, '#despesa-data', '2025-03-06');
    digitar(fixture, '#despesa-valor', '55,00');
    expect(clicarSalvar(fixture)).toBeTrue();
    const req = controle.expectOne('/api/viagens/205/despesas-extras');
    expect(req.request.body).toEqual({ descricao: 'Alimentação', data: '2025-03-06', valor: '55.00' });
    req.flush({ id: 960, descricao: 'Alimentação', data: '2025-03-06', valor: 55 });
  });

  it('abastecimento novo sem quilometragem não é enviado e mostra o erro no campo', () => {
    const fixture = criar({ tipo: 'abastecimentos', combustivel: 'DIESEL' });
    preencherAbastecimento(fixture, '');
    expect(clicarSalvar(fixture)).toBeTrue();
    controle.expectNone('/api/viagens/205/abastecimentos');
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Informe a quilometragem do odômetro');
    expect((fixture.nativeElement as HTMLElement).querySelector(campo(fixture, '-km'))!.getAttribute('aria-invalid')).toBe('true');
    expect(fechar).not.toHaveBeenCalled();
  });

  for (const invalido of ['1500.5', '-1', '10000000']) {
    it(`recusa quilometragem ${invalido} sem converter nem enviar`, () => {
      const fixture = criar({ tipo: 'abastecimentos', combustivel: 'DIESEL' });
      preencherAbastecimento(fixture, invalido);
      clicarSalvar(fixture);
      controle.expectNone('/api/viagens/205/abastecimentos');
      expect(fixture.componentInstance.abastecimento.controls.quilometragem.invalid).toBeTrue();
    });
  }

  it('aceita o limite máximo 9.999.999', () => {
    const fixture = criar({ tipo: 'abastecimentos', combustivel: 'DIESEL' });
    preencherAbastecimento(fixture, '9999999');
    clicarSalvar(fixture);
    const req = controle.expectOne('/api/viagens/205/abastecimentos');
    expect(req.request.body.quilometragem).toBe(9_999_999);
    req.flush({});
  });

  describe('correção (PUT integral)', () => {
    const antigo = (quilometragem: number | null): AbastecimentoResponse =>
      ({ id: 901, tipo: 'DIESEL', data: '2025-03-04', quilometragem, hora: '18:30:00', litros: 100, valorTotal: 640 });

    it('registro antigo sem km: pode continuar vazio (envia null, não zero) e não reenvia a hora antiga', () => {
      const fixture = criar({ tipo: 'abastecimentos', atual: antigo(null) });
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector(campo(fixture, '-km'))!.closest('.campo')!.textContent).toContain('registro antigo, opcional');
      expect((el.querySelector(campo(fixture, '-km')) as HTMLInputElement).value).toBe('');
      digitar(fixture, campo(fixture, '-valor'), '650,00');
      expect(clicarSalvar(fixture)).toBeTrue();
      const req = controle.expectOne('/api/viagens/205/abastecimentos/901');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ tipo: 'DIESEL', data: '2025-03-04', quilometragem: null, litros: '100', valorTotal: '650.00' });
      req.flush(antigo(null));
    });

    it('registro antigo sem km: se informar agora, a km vai no PUT', () => {
      const fixture = criar({ tipo: 'abastecimentos', atual: antigo(null) });
      digitar(fixture, campo(fixture, '-km'), '98000');
      clicarSalvar(fixture);
      const req = controle.expectOne('/api/viagens/205/abastecimentos/901');
      expect(req.request.body.quilometragem).toBe(98000);
      req.flush(antigo(98000));
    });

    it('km já informada não pode ser apagada', () => {
      const fixture = criar({ tipo: 'abastecimentos', atual: antigo(99950) });
      const el = fixture.nativeElement as HTMLElement;
      expect((el.querySelector(campo(fixture, '-km')) as HTMLInputElement).value).toBe('99950');
      expect(el.textContent).not.toContain('registro antigo, opcional');
      digitar(fixture, campo(fixture, '-km'), '');
      clicarSalvar(fixture);
      controle.expectNone('/api/viagens/205/abastecimentos/901');
      expect(el.textContent).toContain('Informe a quilometragem do odômetro');
    });
  });

  describe('datas sem deslocamento de fuso', () => {
    afterEach(() => jasmine.clock().uninstall());

    it('às 23:30 em Brasília (02:30 UTC do dia seguinte), a data sugerida e a enviada são as de Brasília', () => {
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date('2026-11-28T02:30:00Z'));
      const fixture = criar({ tipo: 'pedagios', viagem: viagemEmAndamento({ dataInicio: '2026-11-20' }) });
      const data = (fixture.nativeElement as HTMLElement).querySelector('#pedagio-data') as HTMLInputElement;
      expect(data.value).toBe('2026-11-27');
      expect(data.max).toBe('2026-11-27');
      digitar(fixture, '#pedagio-valor', '12,00');
      clicarSalvar(fixture);
      const req = controle.expectOne('/api/viagens/205/pedagios');
      expect(req.request.body.data).toBe('2026-11-27');
      req.flush({});
    });

    it('a data escolhida chega ao servidor exatamente como foi digitada (AAAA-MM-DD)', () => {
      const fixture = criar({ tipo: 'abastecimentos', combustivel: 'DIESEL' });
      preencherAbastecimento(fixture, '10450');
      digitar(fixture, campo(fixture, '-data'), '2025-01-01');
      clicarSalvar(fixture);
      const req = controle.expectOne('/api/viagens/205/abastecimentos');
      expect(req.request.body.data).toBe('2025-01-01');
      req.flush({});
    });
  });
});
