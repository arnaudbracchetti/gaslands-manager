/**
 * Tests unitaires pour GameForm (composant dumb).
 *
 * Vérifie : validation locale (scénario obligatoire), émission du DTO,
 * pré-remplissage en mode édition (effect sur `game`), émission de formCancel.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { GameForm } from './game-form';
import { Game, Scenario, CreateGameDto } from '../game.model';

const mockScenarios: Scenario[] = [
  { nom: 'La Course de la Mort', nom_interne: 'course_de_la_mort', type: 'EVENEMENT_TELE', description: '' },
  { nom: 'Embuscade', nom_interne: 'embuscade', type: 'ESCARMOUCHE', description: '' },
];

const mockGame: Game = {
  id: 10,
  seasonId: 1,
  scenarioId: 'embuscade',
  scenarioName: 'Embuscade',
  type: 'ESCARMOUCHE',
  status: 'PLANIFIE',
  order: 2,
  playedAt: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

describe('GameForm', () => {
  let component: GameForm;
  let fixture: ComponentFixture<GameForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [GameForm] }).compileComponents();
    fixture = TestBed.createComponent(GameForm);
    component = fixture.componentInstance;
  });

  it('refuse la sauvegarde si aucun scénario n\'est choisi', () => {
    fixture.componentRef.setInput('scenarios', mockScenarios);
    fixture.detectChanges();

    const emitted: CreateGameDto[] = [];
    outputToObservable(component.saved).subscribe((dto) => emitted.push(dto));

    component.saveForm();

    expect(emitted).toHaveLength(0);
    expect(component.formError()).not.toBe('');
  });

  it('émet le DTO avec le scénario choisi', () => {
    fixture.componentRef.setInput('scenarios', mockScenarios);
    fixture.detectChanges();

    const emitted: CreateGameDto[] = [];
    outputToObservable(component.saved).subscribe((dto) => emitted.push(dto));

    component.formScenarioId.set('course_de_la_mort');
    component.saveForm();

    expect(emitted).toEqual([{ scenarioId: 'course_de_la_mort' }]);
  });

  it('pré-remplit le scénario en mode édition', () => {
    fixture.componentRef.setInput('game', mockGame);
    fixture.detectChanges();

    expect(component.isEdit()).toBe(true);
    expect(component.formScenarioId()).toBe('embuscade');
  });

  it('reste en mode création quand game est null', () => {
    fixture.componentRef.setInput('game', null);
    fixture.detectChanges();

    expect(component.isEdit()).toBe(false);
    expect(component.formScenarioId()).toBe('');
  });

  it('émet formCancel à l\'annulation', () => {
    let cancelled = false;
    outputToObservable(component.formCancel).subscribe(() => { cancelled = true; });

    component.cancelForm();

    expect(cancelled).toBe(true);
  });
});
