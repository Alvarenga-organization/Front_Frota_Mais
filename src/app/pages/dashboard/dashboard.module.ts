import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CompartilhadoModule } from '../../compartilhado/compartilhado.module';
import { DashboardComponent } from './dashboard.component';

@NgModule({
  declarations: [DashboardComponent],
  imports: [CommonModule, CompartilhadoModule, RouterModule.forChild([{ path: '', component: DashboardComponent }])]
})
export class DashboardModule {}
