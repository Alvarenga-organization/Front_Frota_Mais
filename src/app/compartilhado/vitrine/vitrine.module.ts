import { NgModule } from '@angular/core';
import { IconeTracoComponent } from './icone-traco.component';
import { PreviaSistemaComponent } from './previa-sistema.component';

/** Peças visuais das telas públicas (página inicial e moldura de acesso). */
@NgModule({
  declarations: [IconeTracoComponent, PreviaSistemaComponent],
  exports: [IconeTracoComponent, PreviaSistemaComponent]
})
export class VitrineModule {}
