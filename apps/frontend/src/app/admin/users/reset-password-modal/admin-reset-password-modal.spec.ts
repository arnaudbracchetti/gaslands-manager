/**
 * Tests unitaires pour AdminResetPasswordModal (composant dumb, compose
 * ModalShell). Mirroir de change-password-modal.spec.ts, moins
 * currentPassword.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { AdminResetPasswordModal } from './admin-reset-password-modal';
import type { User } from '../../../auth/auth.model';

const mockUser: User = {
  id: 2,
  firstName: 'Jean',
  lastName: 'Dupont',
  pseudo: 'JeanLeFou',
  callName: 'JeanLeFou',
  email: 'jean@test.com',
  role: 'user',
  isActive: true,
  createdAt: '2025-01-02T00:00:00.000Z',
  updatedAt: '2025-01-02T00:00:00.000Z',
};

describe('AdminResetPasswordModal', () => {
  let component: AdminResetPasswordModal;
  let fixture: ComponentFixture<AdminResetPasswordModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AdminResetPasswordModal] }).compileComponents();
    fixture = TestBed.createComponent(AdminResetPasswordModal);
    fixture.componentRef.setInput('user', mockUser);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('affiche le pseudo de la cible dans le titre', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('JeanLeFou');
  });

  it('émet submitted (le nouveau mot de passe seul) quand les mots de passe correspondent', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.submitted).subscribe((v) => emitted.push(v));

    component.newPassword.set('nouveauMdp123');
    component.confirmNewPassword.set('nouveauMdp123');
    component.onSubmit();

    expect(emitted).toEqual(['nouveauMdp123']);
  });

  it('n\'affiche pas d\'erreur de correspondance tant que la confirmation est vide', () => {
    component.newPassword.set('nouveauMdp123');

    expect(component.passwordMismatch()).toBe(false);
  });

  it('n\'émet pas submitted si les mots de passe ne correspondent pas', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.submitted).subscribe((v) => emitted.push(v));

    component.newPassword.set('nouveauMdp123');
    component.confirmNewPassword.set('autreChose');
    component.onSubmit();

    expect(component.passwordMismatch()).toBe(true);
    expect(emitted).toEqual([]);
  });

  it('n\'émet pas submitted si le nouveau mot de passe est trop court', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.submitted).subscribe((v) => emitted.push(v));

    component.newPassword.set('abc');
    component.confirmNewPassword.set('abc');
    component.onSubmit();

    expect(emitted).toEqual([]);
  });

  it('affiche l\'erreur serveur', () => {
    fixture.componentRef.setInput('error', 'Erreur lors de la réinitialisation du mot de passe.');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Erreur lors de la réinitialisation du mot de passe.',
    );
  });

  it('émet cancelled au clic sur le bouton de fermeture du shell', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.cancelled).subscribe(() => emitted.push(true));

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.ms-modal__cancel')?.click();

    expect(emitted).toHaveLength(1);
  });

  it('émet submitted au clic sur le bouton d\'action du shell', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.submitted).subscribe((v) => emitted.push(v));

    component.newPassword.set('nouveauMdp123');
    component.confirmNewPassword.set('nouveauMdp123');
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.ms-modal__confirm')?.click();

    expect(emitted).toHaveLength(1);
  });
});
