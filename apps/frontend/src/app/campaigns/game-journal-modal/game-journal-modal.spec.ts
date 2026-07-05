/**
 * Tests unitaires pour GameJournalModal (composant dumb).
 *
 * Vérifie le regroupement par participant (ordre d'apparition préservé),
 * l'état vide et l'état chargement.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { GameJournalModal } from './game-journal-modal';
import type { Game, GameJournalEntryDto } from '../game.model';

const mockGame: Game = {
  id: 10,
  campaignId: 1,
  scenarioId: 'course_de_la_mort',
  scenarioName: 'La Course de la Mort',
  type: 'EVENEMENT_TELE',
  status: 'JOUE',
  order: 1,
  playedAt: '2026-07-01T00:00:00.000Z',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const mockEntries: GameJournalEntryDto[] = [
  { participantId: 2, userName: 'Bob', teamName: 'Idris Racers', description: 'Classé 2 (+5 PC)', createdAt: '2026-07-01T10:00:00.000Z' },
  { participantId: 1, userName: 'Ada', teamName: 'Les Furieux', description: 'Classé 1 (+10 PC)', createdAt: '2026-07-01T10:00:01.000Z' },
  { participantId: 2, userName: 'Bob', teamName: 'Idris Racers', description: '2 porte(s) franchie(s) (+2 PC)', createdAt: '2026-07-01T10:00:02.000Z' },
];

describe('GameJournalModal', () => {
  let component: GameJournalModal;
  let fixture: ComponentFixture<GameJournalModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [GameJournalModal] }).compileComponents();
    fixture = TestBed.createComponent(GameJournalModal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('game', mockGame);
  });

  it('regroupe les entrées par participant, dans l\'ordre d\'apparition', () => {
    fixture.componentRef.setInput('entries', mockEntries);
    fixture.detectChanges();

    const groups = component.groupedEntries();
    expect(groups.map((g) => g.participantId)).toEqual([2, 1]); // Bob apparaît en premier
    expect(groups[0].entries).toHaveLength(2); // les 2 événements de Bob, dans l'ordre reçu
    expect(groups[0].entries[0].description).toBe('Classé 2 (+5 PC)');
    expect(groups[0].entries[1].description).toBe('2 porte(s) franchie(s) (+2 PC)');
    expect(groups[1].entries).toHaveLength(1);
  });

  it('affiche l\'état vide quand aucun événement', () => {
    fixture.componentRef.setInput('entries', []);
    fixture.detectChanges();

    expect(component.groupedEntries()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('Aucun événement enregistré');
  });

  it('affiche l\'état chargement', () => {
    fixture.componentRef.setInput('entries', []);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Chargement du journal');
  });

  it('émet closed au clic sur Fermer', () => {
    fixture.componentRef.setInput('entries', []);
    fixture.detectChanges();

    const emitted: unknown[] = [];
    outputToObservable(component.closed).subscribe(() => emitted.push(true));

    fixture.nativeElement.querySelector('.gjm-modal__close').click();

    expect(emitted).toHaveLength(1);
  });

  it('statusLabel reflète le statut de la partie', () => {
    fixture.componentRef.setInput('entries', []);
    fixture.detectChanges();
    expect(component.statusLabel()).toBe('Jouée');

    fixture.componentRef.setInput('game', { ...mockGame, status: 'ATELIER' });
    expect(component.statusLabel()).toBe('Atelier');
  });
});
