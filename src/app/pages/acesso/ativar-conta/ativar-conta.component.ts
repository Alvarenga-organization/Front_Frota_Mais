import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/api/auth.service';
import { normalizarFalha } from '../../../core/http/falha-api';
import { confirmacaoSenhaValidator, senhaNovaValidator } from '../../../compartilhado/validadores';

/**
 * Ativação do convite do motorista (tela ausente do Figma, criada no padrão do login).
 * O link do e-mail traz `?token=...`: o token é lido uma vez, guardado só em memória
 * e retirado da barra de endereço. Nunca vai para log nem para mensagens.
 */
@Component({
  selector: 'app-ativar-conta',
  standalone: false,
  templateUrl: './ativar-conta.component.html',
  styleUrls: ['../acesso-formulario.css', '../campo-acesso.css']
})
export class AtivarContaComponent implements OnInit {
  private readonly rota = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  private token: string | null = null;
  semToken = false;

  readonly enviando = signal(false);
  /** 400: convite inválido/usado/expirado (mesma mensagem) ou senha fraca (convite continua válido). */
  readonly falha = signal<string[]>([]);

  readonly formulario = inject(FormBuilder).nonNullable.group(
    {
      senha: ['', [Validators.required, senhaNovaValidator]],
      confirmacao: ['', [Validators.required]]
    },
    { validators: confirmacaoSenhaValidator }
  );

  ngOnInit(): void {
    const token = this.rota.snapshot.queryParamMap.get('token');
    this.token = token && token.length <= 200 ? token : null;
    this.semToken = !this.token;
    if (token !== null) {
      this.router.navigate([], { relativeTo: this.rota, queryParams: {}, replaceUrl: true });
    }
  }

  ativar(): void {
    if (this.enviando()) return;
    if (this.formulario.invalid || !this.token) {
      this.formulario.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.falha.set([]);
    this.auth.ativarConvite({ token: this.token, senha: this.formulario.controls.senha.value })
      .pipe(finalize(() => this.enviando.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        // A ativação já autentica como MOTORISTA.
        next: () => {
          this.token = null;
          this.router.navigateByUrl('/inicio');
        },
        error: erro => this.falha.set(normalizarFalha(erro).detalhes)
      });
  }
}
