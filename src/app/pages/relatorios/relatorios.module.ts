import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CompartilhadoModule } from '../../compartilhado/compartilhado.module';
import { RelatoriosComponent } from './relatorios.component';

@NgModule({
  declarations: [RelatoriosComponent],
  imports: [CommonModule, CompartilhadoModule, RouterModule.forChild([{ path: '', component: RelatoriosComponent }])]
})
export class RelatoriosModule {}
