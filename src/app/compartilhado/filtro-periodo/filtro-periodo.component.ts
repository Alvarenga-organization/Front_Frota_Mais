import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FiltroPeriodo } from '../../core/modelos/api.modelos';
import { hojeEmBrasilia } from '../formatacao';
import { Periodo, TipoPeriodo, paraFiltro, periodoPadrao } from './periodo';

/** Filtro de período dos indicadores: mês, ano, semana, intervalo ou todo o histórico. */
@Component({
  selector: 'app-filtro-periodo',
  standalone: false,
  template: `
    <form class="filtro-periodo" (submit)="$event.preventDefault()" aria-label="Período">
      <label class="busca">
        <span class="cdk-visually-hidden">Tipo de período</span>
        <select [value]="periodo.tipo" (change)="mudarTipo($any($event.target).value)" aria-label="Tipo de período">
          <option value="mes">Mês</option>
          <option value="ano">Ano</option>
          <option value="semana">Semana</option>
          <option value="intervalo">Intervalo</option>
          <option value="tudo">Todo o histórico</option>
        </select>
      </label>
      @switch (periodo.tipo) {
        @case ('mes') {
          <label class="busca"><span class="cdk-visually-hidden">Mês</span>
            <input type="month" [value]="periodo.mes" [max]="hoje.slice(0, 7)" (change)="alterar('mes', $any($event.target).value)" aria-label="Mês"></label>
        }
        @case ('ano') {
          <label class="busca"><span class="cdk-visually-hidden">Ano</span>
            <input type="number" min="2000" max="2100" [value]="periodo.ano" (change)="alterar('ano', $any($event.target).value)" aria-label="Ano"></label>
        }
        @case ('semana') {
          <label class="busca"><span>Semana de</span>
            <input type="date" [value]="periodo.semana" [max]="hoje" (change)="alterar('semana', $any($event.target).value)" aria-label="Um dia da semana"></label>
        }
        @case ('intervalo') {
          <label class="busca"><span>De</span>
            <input type="date" [value]="periodo.de" (change)="alterar('de', $any($event.target).value)" aria-label="Data inicial"></label>
          <label class="busca"><span>Até</span>
            <input type="date" [value]="periodo.ate" (change)="alterar('ate', $any($event.target).value)" aria-label="Data final"></label>
        }
      }
    </form>
  `,
  styles: ['.filtro-periodo { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }']
})
export class FiltroPeriodoComponent implements OnInit {
  @Input() periodo: Periodo = periodoPadrao();
  /** Emite só períodos completos, já no formato da API. */
  @Output() readonly filtroMudou = new EventEmitter<{ periodo: Periodo; filtro: FiltroPeriodo }>();

  readonly hoje = hojeEmBrasilia();

  ngOnInit(): void {
    this.emitir();
  }

  mudarTipo(tipo: TipoPeriodo): void {
    this.periodo = { ...this.periodo, tipo };
    this.emitir();
  }

  alterar(campo: 'mes' | 'ano' | 'semana' | 'de' | 'ate', valor: string): void {
    this.periodo = { ...this.periodo, [campo]: campo === 'ano' ? Number(valor) : valor };
    this.emitir();
  }

  private emitir(): void {
    const filtro = paraFiltro(this.periodo);
    if (filtro) this.filtroMudou.emit({ periodo: this.periodo, filtro });
  }
}
