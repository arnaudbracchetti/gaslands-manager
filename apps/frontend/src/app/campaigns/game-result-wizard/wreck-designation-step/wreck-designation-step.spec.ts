import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WreckDesignationStep } from './wreck-designation-step';
import { outputToObservable } from '@angular/core/rxjs-interop';
import type { WreckDesignationResult } from '../../game.model';

const mockParticipants = [
  { id: 1, teamName: 'Équipe Alpha', userName: 'Alice', status: 'VALIDATED', isOrganizer: false } as any,
  { id: 2, teamName: 'Équipe Beta', userName: 'Bob', status: 'VALIDATED', isOrganizer: false } as any,
];

const mockVehicles = new Map([
  [1, [{ vehicleId: 100, nom: 'Voiture Alpha', weightClass: 'MOYEN' as const, hasFavoriDuPublic: true }]],
  [2, [{ vehicleId: 200, nom: 'Buggy Beta', weightClass: 'LEGER' as const, hasFavoriDuPublic: false }]],
]);

describe('WreckDesignationStep', () => {
  let fixture: ComponentFixture<WreckDesignationStep>;
  let component: WreckDesignationStep;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WreckDesignationStep],
    }).compileComponents();
    fixture = TestBed.createComponent(WreckDesignationStep);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('presentParticipants', mockParticipants);
    fixture.componentRef.setInput('participantVehicles', mockVehicles);
    fixture.detectChanges();
  });

  it('liste tous les véhicules des participants présents', () => {
    expect(component.allVehicles()).toHaveLength(2);
  });

  it('un véhicule est Intact par défaut', () => {
    expect(component.stateFor(100).status).toBe('intact');
  });

  it('destroyerCandidatesFor exclut le propriétaire', () => {
    const candidates = component.destroyerCandidatesFor(1);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].id).toBe(2);
  });

  it('setStatus(destroyed) puis setDestroyer alimente destroyedVehicles au next', () => {
    component.setStatus(200, 'destroyed');
    component.setDestroyer(200, '1');

    const emitted: WreckDesignationResult[] = [];
    outputToObservable(component.next).subscribe(v => emitted.push(v));
    component.onNext();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].destroyedVehicles.get(1)).toEqual([{ vehicleId: 200 }]);
  });

  it('un véhicule intact n\'apparaît pas dans wreckedVehicles', () => {
    const emitted: WreckDesignationResult[] = [];
    outputToObservable(component.next).subscribe(v => emitted.push(v));
    component.onNext();

    expect(emitted[0].wreckedVehicles).toEqual([]);
  });

  it('un véhicule "mis en épave seul" apparaît dans wreckedVehicles sans destroyedVehicles', () => {
    component.setStatus(100, 'alone');

    const emitted: WreckDesignationResult[] = [];
    outputToObservable(component.next).subscribe(v => emitted.push(v));
    component.onNext();

    expect(emitted[0].wreckedVehicles).toEqual([
      { participantId: 1, vehicleId: 100, pendingFavoriDuPublic: false },
    ]);
    expect(emitted[0].destroyedVehicles.size).toBe(0);
  });

  it('un véhicule détruit apparaît aussi dans wreckedVehicles (superset)', () => {
    component.setStatus(200, 'destroyed');
    component.setDestroyer(200, '1');

    const emitted: WreckDesignationResult[] = [];
    outputToObservable(component.next).subscribe(v => emitted.push(v));
    component.onNext();

    expect(emitted[0].wreckedVehicles).toEqual([
      { participantId: 2, vehicleId: 200, pendingFavoriDuPublic: false },
    ]);
  });

  it('togglePendingFavoriDuPublic est répercuté dans wreckedVehicles', () => {
    component.setStatus(100, 'alone');
    component.togglePendingFavoriDuPublic(100);

    const emitted: WreckDesignationResult[] = [];
    outputToObservable(component.next).subscribe(v => emitted.push(v));
    component.onNext();

    expect(emitted[0].wreckedVehicles[0].pendingFavoriDuPublic).toBe(true);
  });

  it('revenir à Intact efface le destructeur choisi', () => {
    component.setStatus(200, 'destroyed');
    component.setDestroyer(200, '1');
    component.setStatus(200, 'intact');

    expect(component.stateFor(200).destroyerParticipantId).toBeNull();
  });

  it('back émet void', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.back).subscribe(() => emitted.push(true));
    component.onBack();
    expect(emitted).toHaveLength(1);
  });

  it('formCancel émet void', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.formCancel).subscribe(() => emitted.push(true));
    component.onCancel();
    expect(emitted).toHaveLength(1);
  });

  it('showFavoriDuPublic vaut true par défaut (Événement Télévisé)', () => {
    component.setStatus(100, 'alone');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.wds__favori-checkbox')).toBeTruthy();
  });

  it('masque la case Favori du public quand showFavoriDuPublic est faux (Escarmouche)', () => {
    fixture.componentRef.setInput('showFavoriDuPublic', false);
    component.setStatus(100, 'alone');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.wds__favori-checkbox')).toBeNull();
  });

  it('masque la case si le véhicule n\'est pas éligible, même en épave et showFavoriDuPublic=true', () => {
    component.setStatus(200, 'alone'); // hasFavoriDuPublic: false dans la fixture
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.wds__favori-checkbox')).toBeNull();
  });

  it('n\'affiche pas la case tant que le véhicule reste Intact, même éligible', () => {
    // véhicule 100 : hasFavoriDuPublic true dans la fixture, mais jamais désigné épave/détruit
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.wds__favori-checkbox')).toBeNull();
  });
});
