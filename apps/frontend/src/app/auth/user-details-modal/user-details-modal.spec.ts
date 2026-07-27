/**
 * Tests unitaires pour UserDetailsModal (composant dumb).
 *
 * Vérifie le pré-remplissage depuis l'input `user`, l'émission des deux
 * sous-formulaires (Informations / Mot de passe), la validation client du
 * mot de passe (correspondance/longueur), et l'affichage des erreurs serveur.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { UserDetailsModal } from './user-details-modal';
import type { User } from '../auth.model';

const mockUser: User = {
  id: 1,
  firstName: 'Jean',
  lastName: 'Dupont',
  email: 'jean@test.com',
  role: 'user',
  isActive: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('UserDetailsModal', () => {
  let component: UserDetailsModal;
  let fixture: ComponentFixture<UserDetailsModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [UserDetailsModal] }).compileComponents();
    fixture = TestBed.createComponent(UserDetailsModal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('user', mockUser);
    fixture.detectChanges();
  });

  it('pré-remplit les champs Informations depuis l\'input user', () => {
    expect(component.firstName()).toBe('Jean');
    expect(component.lastName()).toBe('Dupont');
    expect(component.email()).toBe('jean@test.com');
  });

  it('affiche le rôle en lecture seule (aucun champ éditable)', () => {
    expect(component.roleLabel()).toBe('Utilisateur');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Utilisateur');
    expect((fixture.nativeElement as HTMLElement).querySelector('[name="role"]')).toBeFalsy();
  });

  it('affiche "Administrateur" pour un utilisateur admin', () => {
    fixture.componentRef.setInput('user', { ...mockUser, role: 'admin' as const });
    fixture.detectChanges();

    expect(component.roleLabel()).toBe('Administrateur');
  });

  it('émet profileSubmitted avec les champs modifiés', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.profileSubmitted).subscribe((dto) => emitted.push(dto));

    component.firstName.set('Jeanne');
    component.lastName.set('Martin');
    component.email.set('jeanne@test.com');
    component.onProfileSubmit();

    expect(emitted).toEqual([{ firstName: 'Jeanne', lastName: 'Martin', email: 'jeanne@test.com' }]);
  });

  it('n\'émet pas profileSubmitted si un champ obligatoire est vide', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.profileSubmitted).subscribe((dto) => emitted.push(dto));

    component.firstName.set('');
    component.onProfileSubmit();

    expect(emitted).toEqual([]);
  });

  it('émet passwordSubmitted sans confirmNewPassword quand les mots de passe correspondent', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.passwordSubmitted).subscribe((dto) => emitted.push(dto));

    component.currentPassword.set('ancienMdp');
    component.newPassword.set('nouveauMdp123');
    component.confirmNewPassword.set('nouveauMdp123');
    component.onPasswordSubmit();

    expect(emitted).toEqual([{ currentPassword: 'ancienMdp', newPassword: 'nouveauMdp123' }]);
  });

  it('n\'émet pas passwordSubmitted si les mots de passe ne correspondent pas', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.passwordSubmitted).subscribe((dto) => emitted.push(dto));

    component.currentPassword.set('ancienMdp');
    component.newPassword.set('nouveauMdp123');
    component.confirmNewPassword.set('autreChose');
    component.onPasswordSubmit();

    expect(component.passwordMismatch()).toBe(true);
    expect(emitted).toEqual([]);
  });

  it('n\'émet pas passwordSubmitted si le nouveau mot de passe est trop court', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.passwordSubmitted).subscribe((dto) => emitted.push(dto));

    component.currentPassword.set('ancienMdp');
    component.newPassword.set('abc');
    component.confirmNewPassword.set('abc');
    component.onPasswordSubmit();

    expect(emitted).toEqual([]);
  });

  it('affiche l\'erreur serveur du sous-formulaire Informations', () => {
    fixture.componentRef.setInput('profileError', 'Cet email est déjà utilisé');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Cet email est déjà utilisé');
  });

  it('affiche l\'erreur serveur du sous-formulaire Mot de passe', () => {
    fixture.componentRef.setInput('passwordError', 'Mot de passe actuel incorrect');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Mot de passe actuel incorrect');
  });

  it('émet closed au clic sur le bouton de fermeture', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.closed).subscribe(() => emitted.push(true));

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.udm-close')?.click();

    expect(emitted).toHaveLength(1);
  });
});
