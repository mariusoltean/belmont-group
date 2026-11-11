import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ContactService } from '../../core/contact.service';
import { RevealDirective } from '../../core/reveal.directive';
import { TranslatePipe } from '../../core/t.pipe';

type Status = 'idle' | 'sending' | 'sent' | 'failed';
type Field = 'name' | 'email' | 'message';

@Component({
  selector: 'app-contact',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RevealDirective, ReactiveFormsModule],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss',
})
export class ContactComponent {
  private readonly contact = inject(ContactService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    message: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly status = signal<Status>('idle');
  /** Bumped on submit so error messages re-render after `markAllAsTouched`. */
  protected readonly attempt = signal(0);

  /** i18n key of the error to show under a field, or null. */
  protected errorKey(field: Field): string | null {
    this.attempt();
    const control = this.form.controls[field];
    if (!control.invalid || !control.touched) return null;
    if (control.hasError('required')) return `contact.errors.${field}Required`;
    if (control.hasError('email')) return 'contact.errors.emailInvalid';
    return null;
  }

  protected async submit(): Promise<void> {
    if (this.status() === 'sending') return;
    this.form.markAllAsTouched();
    this.attempt.update((n) => n + 1);
    if (this.form.invalid) {
      this.status.set('idle');
      afterNextRender(
        () => this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
        { injector: this.injector },
      );
      return;
    }
    this.status.set('sending');
    try {
      await this.contact.send(this.form.getRawValue());
      this.form.reset();
      this.status.set('sent');
    } catch {
      this.status.set('failed');
    }
  }

  protected onBlur(): void {
    this.attempt.update((n) => n + 1);
  }
}
