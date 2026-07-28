/**
 * Tests unitaires pour UserDetailsModal (composant dumb).
 *
 * Vérifie le pré-remplissage depuis l'input `user`, l'émission du
 * formulaire Informations, et l'affichage des erreurs serveur.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { UserDetailsModal } from './user-details-modal';
import type { User } from '../auth.model';

const mockUser: User = {
  id: 1,
  firstName: 'Jean',
  lastName: 'Dupont',
  pseudo: 'JeanLeFou',
  callName: 'JeanLeFou',
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

  it('émet profileSubmitted avec les champs modifiés', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.profileSubmitted).subscribe((dto) => emitted.push(dto));

    component.firstName.set('Jeanne');
    component.lastName.set('Martin');
    component.pseudo.set('Furiosa');
    component.email.set('jeanne@test.com');
    component.onProfileSubmit();

    expect(emitted).toEqual([{ firstName: 'Jeanne', lastName: 'Martin', pseudo: 'Furiosa', email: 'jeanne@test.com' }]);
  });

  it('n\'émet pas profileSubmitted si un champ obligatoire est vide', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.profileSubmitted).subscribe((dto) => emitted.push(dto));

    component.firstName.set('');
    component.onProfileSubmit();

    expect(emitted).toEqual([]);
  });

  it('affiche l\'erreur serveur du sous-formulaire Informations', () => {
    fixture.componentRef.setInput('profileError', 'Cet email est déjà utilisé');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Cet email est déjà utilisé');
  });

  it('émet cancelled au clic sur le bouton de fermeture du shell', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.cancelled).subscribe(() => emitted.push(true));

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.ms-modal__cancel')?.click();

    expect(emitted).toHaveLength(1);
  });

  it('émet profileSubmitted au clic sur le bouton d\'action du shell', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.profileSubmitted).subscribe((dto) => emitted.push(dto));

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.ms-modal__confirm')?.click();

    expect(emitted).toHaveLength(1);
  });
});
