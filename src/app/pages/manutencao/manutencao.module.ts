import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CompartilhadoModule } from '../../compartilhado/compartilhado.module';
import { ManutencaoComponent } from './manutencao.component';
import { ManutencaoFormularioComponent } from './manutencao-formulario/manutencao-formulario.component';

@NgModule({
  declarations: [ManutencaoComponent, ManutencaoFormularioComponent],
  imports: [CommonModule, ReactiveFormsModule, CompartilhadoModule,
    RouterModule.forChild([{ path: '', component: ManutencaoComponent }])]
})
export class ManutencaoModule {}
