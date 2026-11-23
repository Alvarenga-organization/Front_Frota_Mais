import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DashboardModule } from './dashboard.module';
import { DashboardComponent } from './dashboard.component';
import { RelatoriosModule } from '../relatorios/relatorios.module';
import { RelatoriosComponent, fretesDoPeriodo } from '../relatorios/relatorios.component';
import { IndicadoresService } from '../../core/api/indicadores.service';
import { mesesAte, paraFiltro, periodoPadrao } from '../../compartilhado/filtro-periodo/periodo';
import { CAMINHOES_DONO_MOCK } from '../../../testes/dados/caminhoes.mock';
import { indicadores, indicadoresVazios } from '../../../testes/dados/indicadores.mock';
import { RESUMOS_DONO } from '../../../testes/dados/viagens.mock';
import { entrarComo, limparSessao } from '../../../testes/sessao-de-teste';

describe('Indicadores', () => {
  let controle: HttpTestingController;

  beforeEach(() => {
    limparSessao();
    TestBed.configureTestingModule({
      imports: [DashboardModule, RelatoriosModule],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });
    controle = TestBed.inject(HttpTestingController);
    entrarComo('DONO');
  });

  afterEach(() => {
    controle.verify();
    limparSessao();
  });

  describe('período', () => {
    it('padrão é o mês corrente em Brasília e vira ano+mes', () => {
      const periodo = periodoPadrao('2026-11-19');
      expect(paraFiltro(periodo)).toEqual({ ano: 2026, mes: 11 });
    });

    it('um tipo de filtro por vez (nunca mistura parâmetros)', () => {
      const base = periodoPadrao('2026-11-19');
      expect(paraFiltro({ ...base, tipo: 'ano' })).toEqual({ ano: 2026 });
      expect(paraFiltro({ ...base, tipo: 'semana' })).toEqual({ semana: '2026-11-19' });
      expect(paraFiltro({ ...base, tipo: 'intervalo', de: '2026-01-01', ate: '' })).toEqual({ de: '2026-01-01' });
      expect(paraFiltro({ ...base, tipo: 'intervalo' })).toBeNull();
      expect(paraFiltro({ ...base, tipo: 'tudo' })).toEqual({});
    });

    it('mesesAte atravessa a virada do ano', () => {
      expect(mesesAte('2026-02', 3)).toEqual([{ ano: 2025, mes: 12 }, { ano: 2026, mes: 1 }, { ano: 2026, mes: 2 }]);
    });
  });

  it('IndicadoresService envia só o filtro escolhido', () => {
    const servico = TestBed.inject(IndicadoresService);
    servico.doPeriodo({ ano: 2025, mes: 6 }).subscribe();
    const req = controle.expectOne(r => r.url === '/api/viagens/indicadores');
    expect(req.request.params.keys().sort()).toEqual(['ano', 'mes']);
    req.flush(indicadores());
    servico.porCaminhao({ semana: '2025-06-11' }).subscribe();
    const porCaminhao = controle.expectOne(r => r.url === '/api/viagens/indicadores/por-caminhao');
    expect(porCaminhao.request.params.get('semana')).toBe('2025-06-11');
    porCaminhao.flush([]);
  });

  describe('DashboardComponent', () => {
    function criar(dados = indicadores()): ComponentFixture<DashboardComponent> {
      const fixture = TestBed.createComponent(DashboardComponent);
      fixture.detectChanges();
      controle.expectOne(r => r.url === '/api/caminhoes').flush(CAMINHOES_DONO_MOCK);
      const reqs = controle.match(r => r.url === '/api/viagens/indicadores');
      // 1 chamada do período + 6 da série mensal (a API não tem série).
      expect(reqs.length).toBe(7);
      reqs.forEach(r => r.flush(dados));
      fixture.detectChanges();
      return fixture;
    }

    it('mostra os valores do servidor, com blocos separados de canceladas e manutenções', () => {
      const el: HTMLElement = criar().nativeElement;
      const texto = (el.textContent ?? '').replace(/\s/g, ' ');
      expect(texto).toContain('R$ 3.000,00');
      expect(texto).toContain('R$ 1.850,00'); // resultadoFinanceiroPeriodo, não recalculado
      expect(texto).toContain('Viagens canceladas');
      expect(texto).toContain('R$ 150,00');
      expect(texto).toContain('60%');
      expect(texto).toContain('2 / 3'); // caminhões ativos / não excluídos
    });

    it('período vazio: margem nula aparece como "não calculado", nunca 0%', () => {
      const el: HTMLElement = criar(indicadoresVazios()).nativeElement;
      expect(el.textContent).toContain('Margem: não calculado');
      expect(el.textContent).not.toContain('0%');
    });

    it('fretes incompletos são sinalizados com acesso ao detalhe, sem somar aos totais', () => {
      const el: HTMLElement = criar(indicadores({ viagensIncompletas: 2, viagensComCalculoIncompleto: [7, 8], valorFreteIncompletasNaoIncluido: 900 })).nativeElement;
      expect(el.textContent).toContain('2 frete(s) concluído(s) com cálculo incompleto');
      expect(Array.from(el.querySelectorAll('.resultado-geral a')).map(a => a.getAttribute('href'))).toEqual(['/viagens/7', '/viagens/8']);
    });

    it('403 (perfil mudou no servidor) mostra falha, sem números', () => {
      const fixture = TestBed.createComponent(DashboardComponent);
      fixture.detectChanges();
      controle.expectOne(r => r.url === '/api/caminhoes').flush([]);
      // A série mensal (forkJoin) cancela as demais chamadas após o primeiro erro.
      controle.match(r => r.url === '/api/viagens/indicadores').filter(r => !r.cancelled).forEach(r => {
        if (!r.cancelled) r.flush({ status: 403, erro: 'Acesso negado', detalhes: ['Acesso negado.'] }, { status: 403, statusText: 'Forbidden' });
      });
      fixture.detectChanges();
      expect(fixture.componentInstance.estado()).toBe('falha');
      expect(fixture.nativeElement.textContent).not.toContain('R$');
    });
  });

  describe('RelatoriosComponent', () => {
    it('fretesDoPeriodo usa a data de descarga e o período efetivo do servidor', () => {
      expect(fretesDoPeriodo(RESUMOS_DONO, '2025-03-01', '2025-03-31').map(v => v.id)).toEqual([205]);
      expect(fretesDoPeriodo(RESUMOS_DONO, '2025-04-01', '2025-04-30')).toEqual([]);
      expect(fretesDoPeriodo(RESUMOS_DONO, null, null).map(v => v.id)).toEqual([205]);
    });

    it('carrega indicadores, por caminhão e fretes finalizados; exibe nulos como "não calculado"', () => {
      const fixture = TestBed.createComponent(RelatoriosComponent);
      fixture.detectChanges();
      controle.expectOne(r => r.url === '/api/viagens/indicadores').flush(indicadores({ de: '2025-03-01', ate: '2025-03-31' }));
      controle.expectOne(r => r.url === '/api/viagens/indicadores/por-caminhao').flush([
        { caminhaoId: 1, placa: 'BCB8H89', indicadores: indicadores({ lucroPorKm: null, margemPercentual: null }) }
      ]);
      const viagens = controle.expectOne(r => r.url === '/api/viagens');
      expect(viagens.request.params.get('status')).toBe('FINALIZADA');
      viagens.flush(RESUMOS_DONO.filter(v => v.status === 'FINALIZADA'));
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('[data-caminhao-id="1"]')!.textContent).toContain('não calculado');
      expect(el.querySelector('[data-viagem-id="205"]')!.textContent).toContain('56,99%');
    });
  });
});
