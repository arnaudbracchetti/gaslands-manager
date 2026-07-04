import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { GameResultForm } from './game-result-form';
import { outputToObservable } from '@angular/core/rxjs-interop';
import type { Game } from '../game.model';

const mockParticipants = [
  { id: 1, teamName: 'Équipe Alpha', userName: 'Alice', status: 'VALIDATED', isOrganizer: false } as any,
  { id: 2, teamName: 'Équipe Beta', userName: 'Bob', status: 'VALIDATED', isOrganizer: false } as any,
  { id: 3, teamName: 'Équipe Gamma', userName: 'Carol', status: 'VALIDATED', isOrganizer: false } as any,
];

const mockGame: Game = {
  id: 10,
  campaignId: 1,
  scenarioId: 'course_de_la_mort',
  scenarioName: 'La Course de la Mort',
  type: 'EVENEMENT_TELE',
  status: 'PLANIFIE',
  order: 1,
  playedAt: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

describe('GameResultForm', () => {
  let fixture: ComponentFixture<GameResultForm>;
  let component: GameResultForm;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameResultForm],
      providers: [provideNoopAnimations()],
    }).compileComponents();
    fixture = TestBed.createComponent(GameResultForm);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('game', mockGame);
    fixture.componentRef.setInput('participants', mockParticipants);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();
  });

  it('affiche tous les participants avec checkbox décochée', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes).toHaveLength(3);
    checkboxes.forEach((cb: HTMLInputElement) => expect(cb.checked).toBe(false));
  });

  it('cocher un participant le déplace dans la zone de classement', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    fixture.detectChanges();
    expect(component.presentParticipants().length).toBe(1);
  });

  it('décocher un participant le retire de la zone de classement', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    fixture.detectChanges();
    checkboxes[0].click();
    fixture.detectChanges();
    expect(component.presentParticipants().length).toBe(0);
  });

  it('bouton Valider désactivé si aucune équipe cochée', () => {
    const submitBtn: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(submitBtn.disabled).toBe(true);
  });

  it('bouton Valider actif si au moins une équipe cochée', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    fixture.detectChanges();
    const submitBtn: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(submitBtn.disabled).toBe(false);
  });

  it('saved émet les rangs dans l\'ordre de la liste', () => {
    const emitted: any[] = [];
    outputToObservable(component.saved).subscribe(v => emitted.push(v));

    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    checkboxes[1].click();
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button[type="submit"]').click();
    fixture.detectChanges();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].results[0]).toMatchObject({ participantId: 1, rank: 1 });
    expect(emitted[0].results[1]).toMatchObject({ participantId: 2, rank: 2 });
  });

  it('formCancel émet void au clic Annuler', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.formCancel).subscribe(() => emitted.push(true));
    fixture.nativeElement.querySelector('.grf-modal__actions button[type="button"]').click();
    expect(emitted).toHaveLength(1);
  });

  it('badge classé/non-classé correct : 3 présents → 2 classés', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    [0, 1, 2].forEach(i => { checkboxes[i].click(); });
    fixture.detectChanges();
    expect(component.classifiedCount()).toBe(2);
  });

  it('pointsForRank applique le barème 10/5/2/1 pour un Événement Télé', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    [0, 1, 2].forEach(i => { checkboxes[i].click(); });
    fixture.detectChanges();
    expect(component.pointsForRank(1)).toBe(10);
    expect(component.pointsForRank(2)).toBe(5);
    expect(component.pointsForRank(3)).toBe(0); // 3 présents → 2 classés seulement
  });

  it('pointsForRank est toujours 0 pour une Escarmouche', () => {
    fixture.componentRef.setInput('game', { ...mockGame, type: 'ESCARMOUCHE' });
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    fixture.detectChanges();
    expect(component.pointsForRank(1)).toBe(0);
  });

  it('le badge de points est masqué pour une Escarmouche', () => {
    fixture.componentRef.setInput('game', { ...mockGame, type: 'ESCARMOUCHE' });
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.grf-modal__points')).toBeNull();
  });

  it('le badge de points est affiché pour un Événement Télé', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.grf-modal__points')).not.toBeNull();
  });

  it('moveUp/moveDown permutent les entrées adjacentes', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    [0, 1, 2].forEach(i => { checkboxes[i].click(); });
    fixture.detectChanges();

    component.moveDown(0);
    expect(component.presentParticipants().map(p => p.id)).toEqual([2, 1, 3]);

    component.moveUp(1);
    expect(component.presentParticipants().map(p => p.id)).toEqual([1, 2, 3]);
  });

  it('moveUp/moveDown sont des no-op aux bornes de la liste', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    [0, 1, 2].forEach(i => { checkboxes[i].click(); });
    fixture.detectChanges();

    component.moveUp(0);
    expect(component.presentParticipants().map(p => p.id)).toEqual([1, 2, 3]);

    component.moveDown(2);
    expect(component.presentParticipants().map(p => p.id)).toEqual([1, 2, 3]);
  });

  it('cocher/décocher un participant émet presentParticipantsChanged avec les ids présents', () => {
    const emitted: number[][] = [];
    outputToObservable(component.presentParticipantsChanged).subscribe(v => emitted.push(v));

    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    checkboxes[1].click();
    fixture.detectChanges();

    expect(emitted).toEqual([[1], [1, 2]]);
  });

  it('saved inclut gatesCrossed quand renseigné', () => {
    const emitted: any[] = [];
    outputToObservable(component.saved).subscribe(v => emitted.push(v));

    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    fixture.detectChanges();

    component.setGatesCrossed(1, '3');
    fixture.nativeElement.querySelector('button[type="submit"]').click();
    fixture.detectChanges();

    expect(emitted[0].results[0]).toMatchObject({ participantId: 1, gatesCrossed: 3 });
  });

  it('saved omet gatesCrossed quand à 0', () => {
    const emitted: any[] = [];
    outputToObservable(component.saved).subscribe(v => emitted.push(v));

    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button[type="submit"]').click();
    fixture.detectChanges();

    expect(emitted[0].results[0].gatesCrossed).toBeUndefined();
  });

  it('candidateVehiclesFor exclut la propre équipe du destructeur', () => {
    const vehicles = new Map([
      [1, [{ vehicleId: 100, nom: 'Voiture Alpha', weightClass: 'MOYEN' as const }]],
      [2, [{ vehicleId: 200, nom: 'Buggy Beta', weightClass: 'LEGER' as const }]],
    ]);
    fixture.componentRef.setInput('participantVehicles', vehicles);

    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    checkboxes[1].click();
    fixture.detectChanges();

    const candidates = component.candidateVehiclesFor(1);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].vehicle.vehicleId).toBe(200);
  });

  it('addDestroyedVehicle ajoute le véhicule choisi avec son poids déduit', () => {
    const vehicles = new Map([
      [2, [{ vehicleId: 200, nom: 'Buggy Beta', weightClass: 'LEGER' as const }]],
    ]);
    fixture.componentRef.setInput('participantVehicles', vehicles);

    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    checkboxes[1].click();
    fixture.detectChanges();

    component.setPickerSelection(1, '200');
    component.addDestroyedVehicle(1);

    expect(component.destroyedVehiclesFor(1)).toEqual([{ vehicleId: 200, weightClass: 'LEGER' }]);
  });

  it('removeDestroyedVehicle retire un véhicule de la liste', () => {
    const vehicles = new Map([
      [2, [{ vehicleId: 200, nom: 'Buggy Beta', weightClass: 'LEGER' as const }]],
    ]);
    fixture.componentRef.setInput('participantVehicles', vehicles);

    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    checkboxes[1].click();
    fixture.detectChanges();

    component.setPickerSelection(1, '200');
    component.addDestroyedVehicle(1);
    component.removeDestroyedVehicle(1, 200);

    expect(component.destroyedVehiclesFor(1)).toEqual([]);
  });

  it('saved inclut destroyedVehicles quand renseigné', () => {
    const vehicles = new Map([
      [2, [{ vehicleId: 200, nom: 'Buggy Beta', weightClass: 'LEGER' as const }]],
    ]);
    fixture.componentRef.setInput('participantVehicles', vehicles);

    const emitted: any[] = [];
    outputToObservable(component.saved).subscribe(v => emitted.push(v));

    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    checkboxes[1].click();
    fixture.detectChanges();

    component.setPickerSelection(1, '200');
    component.addDestroyedVehicle(1);

    fixture.nativeElement.querySelector('button[type="submit"]').click();
    fixture.detectChanges();

    expect(emitted[0].results[0].destroyedVehicles).toEqual([{ vehicleId: 200, weightClass: 'LEGER' }]);
  });
});
