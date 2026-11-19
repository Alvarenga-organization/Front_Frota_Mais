import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/api/auth.service';
import { normalizarFalha } from '../../../core/http/falha-api';
import { senhaNovaValidator } from '../../../compartilhado/validadores';

@Component({
  selector: 'app-criar-conta',
  standalone: false,
  templateUrl: './criar-conta.component.html',
  styleUrls: ['../acesso-formulario.css', '../campo-acesso.css']
})
export class CriarContaComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // Campos de RegistroRequest. "Nome da empresa" não está no Figma, mas é obrigatório na API.
  readonly formulario = inject(FormBuilder).nonNullable.group({
    nomeEmpresa: ['', [Validators.required, Validators.maxLength(120)]],
    nome: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
    senha: ['', [Validators.required, senhaNovaValidator]]
  });

  readonly enviando = signal(false);
  readonly falha = signal<string[]>([]);

  criar(): void {
    if (this.enviando()) return;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.falha.set([]);
    const valor = this.formulario.getRawValue();
    this.auth.registrar({
      nomeEmpresa: valor.nomeEmpresa.trim(),
      nome: valor.nome.trim(),
      email: valor.email.trim(),
      senha: valor.senha
    })
      .pipe(finalize(() => this.enviando.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        // O registro já autentica: o DONO entra direto.
        next: () => this.router.navigateByUrl('/inicio'),
        // 409 = e-mail já cadastrado; 400 = validação (ex.: senha fraca).
        error: erro => this.falha.set(normalizarFalha(erro).detalhes)
      });
  }
}
