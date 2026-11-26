import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/api/auth.service';
import { SessaoService } from '../../../core/sessao/sessao.service';
import { normalizarFalha } from '../../../core/http/falha-api';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // Campos de LoginRequest. O Figma rotula como "Usuário", mas a API entra por e-mail.
  readonly formulario = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
    senha: ['', [Validators.required]]
  });

  readonly enviando = signal(false);
  /** Mensagens do servidor (401: credenciais inválidas; 400: validação; rede/500). */
  readonly falha = signal<string[]>([]);
  /** Aviso de sessão encerrada pelo servidor ou por expiração (mostrado uma vez). */
  readonly sessaoEncerrada = inject(SessaoService).consumirMotivo() === 'expirada';

  mostrarAvisoSenha = false;
  /** Só visual: alterna o tipo do campo de senha. */
  senhaVisivel = false;

  entrar(): void {
    if (this.enviando()) return;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.falha.set([]);
    const { email, senha } = this.formulario.getRawValue();
    this.auth.entrar({ email: email.trim(), senha })
      .pipe(finalize(() => this.enviando.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.router.navigateByUrl('/inicio'),
        // 401 aqui é credencial inválida (mesma mensagem para qualquer motivo), não sessão expirada.
        error: erro => {
          this.falha.set(normalizarFalha(erro).detalhes);
          this.formulario.controls.senha.reset();
        }
      });
  }
}
