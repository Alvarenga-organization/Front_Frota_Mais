import { Component } from '@angular/core';
import { NomeIconeTraco } from '../../compartilhado/vitrine/icones-traco';

/**
 * Moldura das telas de acesso (login, criar conta, ativação): formulário à esquerda e
 * painel da marca à direita. Referência visual do painel: design/Main.dc.html.
 */
@Component({
  selector: 'app-acesso',
  standalone: false,
  template: `
    <div class="acesso">
      <main class="lado-formulario">
        <a routerLink="/" class="logo" aria-label="Voltar à página inicial do Frota+">
          <img src="imagens/logo.png" alt="" width="64" height="64">
        </a>
        <div class="area-formulario">
          <router-outlet></router-outlet>
        </div>
        <p class="direitos">© {{ ano }} Frota+ · Todos os direitos reservados</p>
      </main>
      <aside class="painel-marca" aria-label="Sobre o Frota+">
        <span class="anel" aria-hidden="true"></span>
        <div class="texto-marca">
          <span class="etiqueta">Sistema de gestão de frotas</span>
          <p class="titulo-marca">Gestão completa da sua frota</p>
          <p class="subtitulo-marca">Mais controle, menos custos, e a sua frota sempre em movimento.</p>
        </div>
        <app-previa-sistema class="previa"></app-previa-sistema>
        <ul class="recursos">
          @for (recurso of recursos; track recurso.texto) {
            <li>
              <span class="recurso-icone"><app-icone-traco [nome]="recurso.icone"></app-icone-traco></span>
              {{ recurso.texto }}
            </li>
          }
        </ul>
      </aside>
    </div>
  `,
  styleUrls: ['./acesso.component.css']
})
export class AcessoComponent {
  readonly ano = new Date().getFullYear();

  readonly recursos: readonly { texto: string; icone: NomeIconeTraco }[] = [
    { texto: 'Controle de viagens', icone: 'rota' },
    { texto: 'Abastecimentos de diesel e Arla', icone: 'combustivel' },
    { texto: 'Controle de manutenções', icone: 'manutencao' },
    { texto: 'Rentabilidade por frete', icone: 'grafico' }
  ];
}
