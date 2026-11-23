import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AppRoutingModule } from './app-routing.module';
import { LayoutModule } from './layout/layout.module';
import { AppComponent } from './app.component';
import { autenticacaoInterceptor } from './core/http/autenticacao.interceptor';


@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, BrowserAnimationsModule, LayoutModule, AppRoutingModule],
  // Único ponto de configuração do HttpClient (todas as páginas usam este provedor).
  providers: [provideHttpClient(withInterceptors([autenticacaoInterceptor]))],
  bootstrap: [AppComponent]
})
export class AppModule {}
