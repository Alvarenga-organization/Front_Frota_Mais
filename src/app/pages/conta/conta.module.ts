import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ContaComponent } from './conta.component';

@NgModule({
  declarations: [ContaComponent],
  imports: [CommonModule, ReactiveFormsModule, RouterModule.forChild([{ path: '', component: ContaComponent }])]
})
export class ContaModule {}
