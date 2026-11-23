import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CompartilhadoModule } from '../../compartilhado/compartilhado.module';
import { ViagensComponent } from './viagens.component';
import { ViagemDetalheComponent } from './detalhe/viagem-detalhe.component';
import { AberturaViagemComponent } from './abertura/abertura-viagem.component';
import { EdicaoViagemComponent } from './edicao/edicao-viagem.component';
import { FinalizacaoViagemComponent } from './finalizacao/finalizacao-viagem.component';
import { CancelamentoViagemComponent } from './cancelamento/cancelamento-viagem.component';
import { LancamentoFormularioComponent } from './lancamento/lancamento-formulario.component';
import { CamposAbastecimentoComponent } from './lancamento/campos-abastecimento.component';
import { HistoricaViagemComponent } from './historica/historica-viagem.component';

@NgModule({
  declarations: [
    ViagensComponent, ViagemDetalheComponent, AberturaViagemComponent, EdicaoViagemComponent, FinalizacaoViagemComponent,
    CancelamentoViagemComponent, LancamentoFormularioComponent, CamposAbastecimentoComponent, HistoricaViagemComponent
  ],
  imports: [CommonModule, ReactiveFormsModule, CompartilhadoModule,
    RouterModule.forChild([
      { path: '', component: ViagensComponent },
      { path: ':id', component: ViagemDetalheComponent, title: 'Viagem | Frota+' }
    ])]
})
export class ViagensModule {}
