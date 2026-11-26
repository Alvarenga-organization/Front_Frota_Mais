import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Ilustração estática de uma viagem (mapa da rota e contadores) para as telas públicas.
 * Os números são de exemplo e estão rotulados como tal: não vêm da API.
 */
@Component({
  selector: 'app-previa-sistema',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="previa" role="img" aria-label="Exemplo ilustrativo da tela de uma viagem em andamento">
      <div class="topo">
        <span class="titulo">Viagem em andamento</span>
        <span class="selo">Exemplo</span>
      </div>
      <div class="mapa" [style.height.px]="alturaMapa">
        <svg width="100%" height="100%" viewBox="0 0 520 150" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 40h520M0 100h520M120 0v150M300 0v150M430 0v150" stroke="#DCE4F0" stroke-width="10" />
          <path d="M30 120 C120 120 120 40 220 50 S340 110 420 70 S490 30 505 30" fill="none" stroke="#0B57D0"
            stroke-width="4" stroke-linecap="round" />
          <circle cx="30" cy="120" r="7" fill="#FFFFFF" stroke="#0B57D0" stroke-width="3" />
          <circle cx="505" cy="30" r="7" fill="#0B57D0" />
          <circle cx="300" cy="86" r="11" fill="#F59E0B" stroke="#FFFFFF" stroke-width="3" />
        </svg>
      </div>
      <div class="contadores">
        <div><span>Km carregado</span><strong class="azul">412</strong></div>
        <div><span>Km vazio</span><strong>38</strong></div>
        <div><span>Lançamentos</span><strong class="ambar">5</strong></div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .previa { background: #FFFFFF; border-radius: 16px; padding: 20px; color: #0F1B2D; box-shadow: 0 24px 60px rgba(0, 0, 0, .35); }
    .topo { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
    .titulo { font-size: 14px; font-weight: 700; }
    .selo { padding: 3px 10px; border-radius: 999px; background: #EAF1FF; color: #0B47A8; font-size: 12px; font-weight: 600; }
    .mapa { border-radius: 10px; background: #EEF3FA; overflow: hidden; }
    .mapa svg { display: block; }
    .contadores { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
    .contadores div { padding: 10px 12px; border-radius: 10px; background: #F5F8FC; display: flex; flex-direction: column; min-width: 0; }
    .contadores span { font-size: 12px; color: #5B6577; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .contadores strong { font-size: 20px; font-weight: 800; }
    .azul { color: #0B57D0; }
    .ambar { color: #B45309; }
    @media (max-width: 480px) {
      .previa { padding: 14px; }
      .contadores { gap: 6px; }
      .contadores div { padding: 8px; }
      .contadores strong { font-size: 17px; }
    }
  `]
})
export class PreviaSistemaComponent {
  @Input() alturaMapa = 150;
}
