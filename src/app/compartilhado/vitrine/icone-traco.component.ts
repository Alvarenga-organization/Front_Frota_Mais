import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ICONES_TRACO, NomeIconeTraco } from './icones-traco';

/** Ícone de traço decorativo; herda a cor do texto. */
@Component({
  selector: 'app-icone-traco',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg viewBox="0 0 24 24" [attr.width]="tamanho" [attr.height]="tamanho" fill="none" stroke="currentColor"
    [attr.stroke-width]="espessura" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path [attr.d]="caminho"></path></svg>`,
  styles: [':host { display: inline-flex; line-height: 0; }']
})
export class IconeTracoComponent {
  @Input({ required: true }) nome!: NomeIconeTraco;
  @Input() tamanho = 20;
  @Input() espessura = 2;

  get caminho(): string {
    return ICONES_TRACO[this.nome];
  }
}
