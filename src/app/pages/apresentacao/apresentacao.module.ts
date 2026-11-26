import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { VitrineModule } from '../../compartilhado/vitrine/vitrine.module';
import { ApresentacaoComponent } from './apresentacao.component';

const routes: Routes = [
  { path: '', component: ApresentacaoComponent, title: 'Frota+ | Gestão que move resultados' }
];

@NgModule({
  declarations: [ApresentacaoComponent],
  imports: [CommonModule, VitrineModule, RouterModule.forChild(routes)]
})
export class ApresentacaoModule {}
