/**
 * Composant SeasonDetail — page "/seasons/:id".
 *
 * Composant "smart" (cf. season-join.ts) : lit l'id de saison dans l'URL,
 * charge le détail de la saison (GET /api/seasons/:id) et ses participants
 * (GET /api/seasons/:id/participants), puis délègue l'affichage à
 * ParticipantList (deux listes : "Validés" et "En attente").
 *
 * CA3 : si l'utilisateur n'a pas de SeasonParticipant VALIDATED pour cette
 * saison, le backend renvoie 404 — affiché ici comme un message d'erreur
 * générique (pas de fuite d'information).
 *
 * CA4/CA5 : Valider/Refuser met à jour le signal `participants` localement
 * (sans recharger la page) — le participant change de liste immédiatement.
 */
import { Component, OnInit, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SeasonsService } from '../seasons.service';
import { Season } from '../season.model';
import { SeasonParticipant } from '../season-participant.model';
import { ParticipantList } from '../participant-list/participant-list';

@Component({
  selector: 'app-season-detail',
  standalone: true,
  imports: [ParticipantList],
  templateUrl: './season-detail.html',
  styleUrl: './season-detail.scss',
})
export class SeasonDetail implements OnInit {
  private route: ActivatedRoute = inject(ActivatedRoute);
  private seasonsService: SeasonsService = inject(SeasonsService);

  /** Id de la saison lu depuis l'URL */
  private seasonId: number = Number(this.route.snapshot.params['id']);

  /** Vrai pendant le chargement initial */
  loading: WritableSignal<boolean> = signal(true);

  /** Message d'erreur générique (CA3) — vide si pas d'erreur */
  error: WritableSignal<string> = signal('');

  /** Détail de la saison — null si non chargé ou en erreur */
  season: WritableSignal<Season | null> = signal<Season | null>(null);

  /** Tous les participants de la saison (tous statuts) */
  participants: WritableSignal<SeasonParticipant[]> = signal<SeasonParticipant[]>([]);

  /** Participants validés */
  validated: Signal<SeasonParticipant[]> = computed(() =>
    this.participants().filter((p) => p.status === 'VALIDATED'),
  );

  /** Demandes en attente de validation */
  pending: Signal<SeasonParticipant[]> = computed(() =>
    this.participants().filter((p) => p.status === 'PENDING'),
  );

  /** Vrai si l'utilisateur connecté est organisateur de cette saison */
  isOrganizer: Signal<boolean> = computed(() => this.season()?.myRole === 'organizer');

  ngOnInit(): void {
    this.loading.set(true);
    this.error.set('');

    this.seasonsService.getOne(this.seasonId).subscribe({
      next: (season: Season) => {
        this.season.set(season);
        this.loadParticipants();
      },
      error: () => {
        this.error.set('Cette saison est introuvable ou vous n\'y avez pas accès.');
        this.loading.set(false);
      },
    });
  }

  private loadParticipants(): void {
    this.seasonsService.getParticipants(this.seasonId).subscribe({
      next: (participants: SeasonParticipant[]) => {
        this.participants.set(participants);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Cette saison est introuvable ou vous n\'y avez pas accès.');
        this.loading.set(false);
      },
    });
  }

  /**
   * Valide ou refuse une demande PENDING — met à jour le statut localement
   * sans recharger la liste complète (CA4/CA5).
   */
  onValidate(event: { pid: number; accept: boolean }): void {
    this.seasonsService.validateParticipant(this.seasonId, event.pid, { accept: event.accept }).subscribe({
      next: (updated: SeasonParticipant) => {
        this.participants.set(
          this.participants().map((p) => (p.id === updated.id ? updated : p)),
        );
      },
    });
  }
}
