/**
 * Tests unitaires pour ParticipantJournalModal (composant dumb).
 *
 * Vérifie le regroupement par partie (ordre d'apparition préservé), l'état
 * vide, l'état chargement, et l'émission de closed.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { ParticipantJournalModal } from './participant-journal-modal';
import type { CampaignParticipant } from '../campaign-participant.model';
import type { ParticipantJournalEntryDto } from '../game.model';

const mockParticipant: CampaignParticipant = {
  id: 1,
  userId: 42,
  teamId: 7,
  status: 'VALIDATED',
  isOrganizer: false,
  userName: 'Ada Lovelace',
  teamName: 'Les Furieux',
};

const mockEntries: ParticipantJournalEntryDto[] = [
  { eventId: 100, gameId: 7, gameOrder: 1, scenarioName: 'La Porte', description: 'Classé 1 (+10 PC)', createdAt: '2026-07-01T10:00:00.000Z' },
  { eventId: 102, gameId: 8, gameOrder: 2, scenarioName: 'La Course', description: 'Budget : +4 jerricans (Récompense)', createdAt: '2026-07-02T10:00:00.000Z' },
  { eventId: 101, gameId: 7, gameOrder: 1, scenarioName: 'La Porte', description: '2 porte(s) franchie(s) (+2 PC)', createdAt: '2026-07-01T10:05:00.000Z' },
];

describe('ParticipantJournalModal', () => {
  let component: ParticipantJournalModal;
  let fixture: ComponentFixture<ParticipantJournalModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ParticipantJournalModal] }).compileComponents();
    fixture = TestBed.createComponent(ParticipantJournalModal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('participant', mockParticipant);
  });

  it('regroupe les entrées par partie, dans l\'ordre d\'apparition', () => {
    fixture.componentRef.setInput('entries', mockEntries);
    fixture.detectChanges();

    const groups = component.groupedEntries();
    expect(groups.map((g) => g.gameId)).toEqual([7, 8]); // partie 7 apparaît en premier
    expect(groups[0].entries).toHaveLength(2); // les 2 événements de la partie 7, dans l'ordre reçu
    expect(groups[0].entries[0].description).toBe('Classé 1 (+10 PC)');
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

    expect(fixture.nativeElement.textContent).toContain('Chargement de l\'historique');
  });

  it('émet closed au clic sur Fermer', () => {
    fixture.componentRef.setInput('entries', []);
    fixture.detectChanges();

    const emitted: unknown[] = [];
    outputToObservable(component.closed).subscribe(() => emitted.push(true));

    fixture.nativeElement.querySelector('.ms-modal__cancel').click();

    expect(emitted).toHaveLength(1);
  });
});
