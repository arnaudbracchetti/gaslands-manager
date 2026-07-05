import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WreckResolutionStep } from './wreck-resolution-step';
import { outputToObservable } from '@angular/core/rxjs-interop';
import type { WreckOutcomeDto, WreckedVehicleEntry } from '../../game.model';

const mockWrecked: WreckedVehicleEntry[] = [
  { participantId: 1, vehicleId: 100, pendingFavoriDuPublic: false },
  { participantId: 2, vehicleId: 200, pendingFavoriDuPublic: true },
];

describe('WreckResolutionStep', () => {
  let fixture: ComponentFixture<WreckResolutionStep>;
  let component: WreckResolutionStep;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WreckResolutionStep],
    }).compileComponents();
    fixture = TestBed.createComponent(WreckResolutionStep);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('wreckedVehicles', mockWrecked);
    fixture.detectChanges();
  });

  it('allResolved est faux tant que tous les véhicules n\'ont pas de résultat', () => {
    expect(component.allResolved()).toBe(false);
  });

  it('allResolved devient vrai une fois tous les résultats reçus', () => {
    const outcome: WreckOutcomeDto = {
      vehicleId: 100, diceRoll: 3, chocsBefore: 0, wreckResult: 'INDEMNE', chocsGained: 0, lostEquipment: null,
    };
    const outcomes = new Map([[100, outcome], [200, outcome]]);
    fixture.componentRef.setInput('outcomes', outcomes);
    expect(component.allResolved()).toBe(true);
  });

  it('destroyerLabel résout le libellé du destructeur, null si non détruit', () => {
    fixture.componentRef.setInput('destroyedBy', new Map([[200, 'Les Furieux']]));
    expect(component.destroyerLabel(200)).toBe('Les Furieux');
    expect(component.destroyerLabel(100)).toBeNull();
  });

  it('descriptionsFor résout les lignes de texte reçues, tableau vide sinon', () => {
    fixture.componentRef.setInput('descriptions', new Map([[100, ['Ligne 1', 'Ligne 2']]]));
    expect(component.descriptionsFor(100)).toEqual(['Ligne 1', 'Ligne 2']);
    expect(component.descriptionsFor(200)).toEqual([]);
  });

  it('onComplete n\'émet rien tant que tout n\'est pas résolu', () => {
    const emitted: unknown[] = [];
    outputToObservable(component.completed).subscribe(() => emitted.push(true));
    component.onComplete();
    expect(emitted).toHaveLength(0);
  });

  it('onComplete émet une fois tout résolu', () => {
    const outcome: WreckOutcomeDto = {
      vehicleId: 100, diceRoll: 3, chocsBefore: 0, wreckResult: 'INDEMNE', chocsGained: 0, lostEquipment: null,
    };
    fixture.componentRef.setInput('outcomes', new Map([[100, outcome], [200, outcome]]));

    const emitted: unknown[] = [];
    outputToObservable(component.completed).subscribe(() => emitted.push(true));
    component.onComplete();
    expect(emitted).toHaveLength(1);
  });

  it('lostEquipmentLabel décrit une arme ou une amélioration perdue', () => {
    const weaponLost: WreckOutcomeDto = {
      vehicleId: 100, diceRoll: 5, chocsBefore: 0, wreckResult: 'ARRACHEE', chocsGained: 1,
      lostEquipment: { kind: 'weapon', id: 7 },
    };
    expect(component.lostEquipmentLabel(weaponLost)).toContain('Arme #7');

    const improvementLost: WreckOutcomeDto = { ...weaponLost, lostEquipment: { kind: 'improvement', id: 9 } };
    expect(component.lostEquipmentLabel(improvementLost)).toContain('Amélioration #9');
  });

  it('reminderFor renvoie un rappel pour CHASSIS_FRAGILISE et null pour INDEMNE', () => {
    expect(component.reminderFor('CHASSIS_FRAGILISE')).not.toBeNull();
    expect(component.reminderFor('INDEMNE')).toBeNull();
  });
});
