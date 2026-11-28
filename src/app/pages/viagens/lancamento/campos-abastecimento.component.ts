import { Component, Input } from '@angular/core';
import { Validators } from '@angular/forms';
import { FORMATO } from '../../../compartilhado/validadores';
import { GrupoAbastecimento, precoPorLitroDigitado } from './lancamento-campos';

let proximoId = 0;

/** Campos de um abastecimento (tipo, data, quilometragem, litros, valor pago). */
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
        <label [for]="id + '-km'">Quilometragem do caminhão (km)
          @if (!kmObrigatoria()) { <span class="opcional">— registro antigo, opcional</span> }
        </label>
        <input [id]="id + '-km'" type="number" inputmode="numeric" step="1" min="0" [max]="formato.km.maximo"
          formControlName="quilometragem" placeholder="Odômetro no abastecimento" [attr.aria-invalid]="invalido('quilometragem')"
          [attr.aria-describedby]="invalido('quilometragem') ? id + '-km-erro' : null">
        @if (invalido('quilometragem')) {
          <p class="erro-campo-formulario" [id]="id + '-km-erro'">Informe a quilometragem do odômetro (número inteiro de 0 a 9.999.999).</p>
        }
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

  /** Falso só na correção de registro antigo sem km (ver `quilometragemObrigatoria`). */
  kmObrigatoria(): boolean {
    return this.grupo.controls.quilometragem.hasValidator(Validators.required);
  }

  invalido(campo: 'data' | 'quilometragem' | 'litros' | 'valorTotal'): boolean {
    const controle = this.grupo.controls[campo];
    return controle.invalid && (controle.touched || controle.dirty);
  }

  precoLitro(): number | null {
    return precoPorLitroDigitado(this.grupo);
  }
}
