import { Component, Input } from '@angular/core';
import { FORMATO } from '../../../compartilhado/validadores';
import { GrupoAbastecimento, precoPorLitroDigitado } from './lancamento-campos';

let proximoId = 0;

/** Campos de um abastecimento (tipo, data, hora opcional, litros, valor pago). */
@Component({
  selector: 'app-campos-abastecimento',
  standalone: false,
  template: `
    <div class="grade-formulario" [formGroup]="grupo">
      <div class="campo">
        <label [for]="id + '-tipo'">Combustível</label>
        <select [id]="id + '-tipo'" formControlName="tipo">
          <option value="DIESEL">Diesel</option>
          <option value="ARLA">Arla</option>
        </select>
      </div>
      <div class="campo">
        <label [for]="id + '-data'">Data</label>
        <input [id]="id + '-data'" type="date" formControlName="data" [max]="hoje"
          [attr.aria-invalid]="invalido('data')">
        @if (ajudaData) {
          <p class="ajuda-campo">{{ ajudaData }}</p>
        }
        @if (invalido('data')) {
          <p class="erro-campo-formulario">Informe a data.</p>
        }
      </div>
      <div class="campo">
        <label [for]="id + '-hora'">Hora <span class="opcional">— opcional</span></label>
        <input [id]="id + '-hora'" type="time" formControlName="hora">
      </div>
      <div class="campo">
        <label [for]="id + '-litros'">Litros</label>
        <input [id]="id + '-litros'" inputmode="decimal" formControlName="litros" placeholder="Ex: 250,5"
          [attr.aria-invalid]="invalido('litros')">
        @if (invalido('litros')) {
          <p class="erro-campo-formulario">Informe os litros (maior que zero, até {{ formato.litros.casas }} casas).</p>
        }
      </div>
      <div class="campo">
        <label [for]="id + '-valor'">Valor total pago (R$)</label>
        <input [id]="id + '-valor'" inputmode="decimal" formControlName="valorTotal" placeholder="Ex: 1.553,10"
          [attr.aria-invalid]="invalido('valorTotal')">
        @if (invalido('valorTotal')) {
          <p class="erro-campo-formulario">Informe o valor pago (maior que zero, até 2 casas).</p>
        }
        @if (precoLitro(); as preco) {
          <p class="ajuda-campo">Conferência: R$ {{ preco | numero:3 }} por litro (só ajuda de digitação).</p>
        }
      </div>
    </div>
  `
})
export class CamposAbastecimentoComponent {
  @Input({ required: true }) grupo!: GrupoAbastecimento;
  @Input({ required: true }) hoje!: string;
  @Input() ajudaData: string | null = null;

  readonly id = `abastecimento-${++proximoId}`;
  readonly formato = FORMATO;

  invalido(campo: 'data' | 'litros' | 'valorTotal'): boolean {
    const controle = this.grupo.controls[campo];
    return controle.invalid && (controle.touched || controle.dirty);
  }

  precoLitro(): number | null {
    return precoPorLitroDigitado(this.grupo);
  }
}
