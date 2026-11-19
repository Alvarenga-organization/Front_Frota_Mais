import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/api/auth.service';
import { SessaoService } from '../../core/sessao/sessao.service';
import { normalizarFalha } from '../../core/http/falha-api';
import { senhaNovaValidator } from '../../compartilhado/validadores';

const ROTULO_PERFIL = { DONO: 'Dono', MOTORISTA: 'Motorista' } as const;

function confirmacaoNovaSenha(grupo: AbstractControl): ValidationErrors | null {
  const nova = grupo.get('novaSenha')?.value;
  const confirmacao = grupo.get('confirmacao')?.value;
  return nova && confirmacao && nova !== confirmacao ? { confirmacaoDiferente: true } : null;
}

/**
 * Conta do usuário (tela ausente do Figma). Só o que a API oferece:
 * troca da própria senha (POST /api/auth/senha). Não há edição de nome, e-mail
 * ou empresa, nem recuperação de senha.
 */
@Component({
  selector: 'app-conta',
  standalone: false,
  templateUrl: './conta.component.html',
  styleUrls: ['./conta.component.css']
})
export class ContaComponent {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sessao = inject(SessaoService);

  readonly nome = this.sessao.nome;
  readonly perfil = () => {
    const perfil = this.sessao.perfil();
    return perfil ? ROTULO_PERFIL[perfil] : '';
  };

  readonly enviando = signal(false);
  readonly falha = signal<string[]>([]);
  readonly sucesso = signal(false);

  readonly formulario = inject(FormBuilder).nonNullable.group(
    {
      senhaAtual: ['', [Validators.required]],
      novaSenha: ['', [Validators.required, senhaNovaValidator]],
      confirmacao: ['', [Validators.required]]
    },
    { validators: confirmacaoNovaSenha }
  );

  invalido(campo: 'senhaAtual' | 'novaSenha' | 'confirmacao'): boolean {
    const controle = this.formulario.controls[campo];
    return controle.invalid && controle.touched;
  }

  trocarSenha(): void {
    if (this.enviando()) return;
    this.sucesso.set(false);
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.falha.set([]);
    const { senhaAtual, novaSenha } = this.formulario.getRawValue();
    this.auth.trocarSenha({ senhaAtual, novaSenha })
      .pipe(finalize(() => this.enviando.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.sucesso.set(true);
          this.formulario.reset();
        },
        // 400 (senha atual incorreta ou nova fraca) não desloga; 401 é tratado pelo interceptor.
        error: erro => {
          const falha = normalizarFalha(erro);
          if (falha.status !== 401) this.falha.set(falha.detalhes);
        }
      });
  }
}
