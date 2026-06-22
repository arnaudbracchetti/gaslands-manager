/**
 * Tests unitaires pour GameList (composant dumb).
 *
 * Vérifie : émission des actions edit/delete, et la règle canModify
 * (gérable ET partie PLANIFIE) qui conditionne l'affichage des boutons.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { GameList } from './game-list';
import { Game } from '../game.model';

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 1,
    seasonId: 1,
    scenarioId: 'course_de_la_mort',
    scenarioName: 'La Course de la Mort',
    type: 'EVENEMENT_TELE',
    status: 'PLANIFIE',
    order: 1,
    playedAt: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('GameList', () => {
  let component: GameList;
  let fixture: ComponentFixture<GameList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [GameList] }).compileComponents();
    fixture = TestBed.createComponent(GameList);
    component = fixture.componentInstance;
  });

  it('autorise la modification d\'une partie PLANIFIE quand gérable', () => {
    fixture.componentRef.setInput('games', [makeGame()]);
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();

    expect(component.canModify(makeGame({ status: 'PLANIFIE' }))).toBe(true);
  });

  it('interdit la modification d\'une partie JOUE même si gérable', () => {
    fixture.componentRef.setInput('games', [makeGame()]);
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();

    expect(component.canModify(makeGame({ status: 'JOUE' }))).toBe(false);
  });

  it('interdit la modification quand non gérable', () => {
    fixture.componentRef.setInput('games', [makeGame()]);
    fixture.componentRef.setInput('canManage', false);
    fixture.detectChanges();

    expect(component.canModify(makeGame())).toBe(false);
  });

  it('émet editGame avec la partie', () => {
    fixture.componentRef.setInput('games', [makeGame()]);
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();

    const emitted: Game[] = [];
    outputToObservable(component.editGame).subscribe((g) => emitted.push(g));

    const game = makeGame({ id: 5 });
    component.editGame.emit(game);

    expect(emitted).toEqual([game]);
  });

  it('émet deleteGame avec la partie', () => {
    fixture.componentRef.setInput('games', [makeGame()]);
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();

    const emitted: Game[] = [];
    outputToObservable(component.deleteGame).subscribe((g) => emitted.push(g));

    const game = makeGame({ id: 5 });
    component.deleteGame.emit(game);

    expect(emitted).toEqual([game]);
  });

  it('fournit des libellés lisibles de type et statut', () => {
    expect(component.typeLabel(makeGame({ type: 'EVENEMENT_TELE' }))).toBe('Événement Télévisé');
    expect(component.typeLabel(makeGame({ type: 'ESCARMOUCHE' }))).toBe('Escarmouche');
    expect(component.statusLabel(makeGame({ status: 'PLANIFIE' }))).toBe('Planifiée');
    expect(component.statusLabel(makeGame({ status: 'JOUE' }))).toBe('Jouée');
  });
});
