/**
 * Tests unitaires pour ChangePasswordModal (composant dumb, compose ModalShell).
 *
 * Vérifie l'émission de submitted, la validation client du mot de passe
 * (correspondance/longueur), et l'affichage des erreurs serveur.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { ChangePasswordModal } from './change-password-modal';

describe('ChangePasswordModal', () => {
  let component: ChangePasswordModal;
  let fixture: ComponentFixture<ChangePasswordModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ChangePasswordModal] }).compileComponents();
    fixture = TestBed.createComponent(ChangePasswordModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('émet submitted sans confirmNewPassword quand les mots de passe correspondent', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.submitted).subscribe((dto) => emitted.push(dto));

    component.currentPassword.set('ancienMdp');
    component.newPassword.set('nouveauMdp123');
    component.confirmNewPassword.set('nouveauMdp123');
    component.onSubmit();

    expect(emitted).toEqual([{ currentPassword: 'ancienMdp', newPassword: 'nouveauMdp123' }]);
  });

  it('n\'émet pas submitted si les mots de passe ne correspondent pas', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.submitted).subscribe((dto) => emitted.push(dto));

    component.currentPassword.set('ancienMdp');
    component.newPassword.set('nouveauMdp123');
    component.confirmNewPassword.set('autreChose');
    component.onSubmit();

    expect(component.passwordMismatch()).toBe(true);
    expect(emitted).toEqual([]);
  });

  it('n\'émet pas submitted si le nouveau mot de passe est trop court', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.submitted).subscribe((dto) => emitted.push(dto));

    component.currentPassword.set('ancienMdp');
    component.newPassword.set('abc');
    component.confirmNewPassword.set('abc');
    component.onSubmit();

    expect(emitted).toEqual([]);
  });

  it('affiche l\'erreur serveur', () => {
    fixture.componentRef.setInput('error', 'Mot de passe actuel incorrect');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Mot de passe actuel incorrect');
  });

  it('émet cancelled au clic sur le bouton de fermeture du shell', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.cancelled).subscribe(() => emitted.push(true));

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.ms-modal__cancel')?.click();

    expect(emitted).toHaveLength(1);
  });

  it('émet submitted au clic sur le bouton d\'action du shell', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.submitted).subscribe((dto) => emitted.push(dto));

    component.currentPassword.set('ancienMdp');
    component.newPassword.set('nouveauMdp123');
    component.confirmNewPassword.set('nouveauMdp123');
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.ms-modal__confirm')?.click();

    expect(emitted).toHaveLength(1);
  });
});
