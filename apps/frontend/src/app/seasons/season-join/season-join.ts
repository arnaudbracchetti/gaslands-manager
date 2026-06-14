/**
 * Composant SeasonJoin — page "/seasons/join/:code".
 *
 * Composant "smart" (cf. seasons.ts) : lit le code d'invitation dans l'URL,
 * charge le résumé minimal de la saison (GET /api/seasons/by-code/:code) et
 * les équipes de l'utilisateur (TeamsService, même pattern que Seasons), puis
 * permet de soumettre une demande d'inscription (POST
 * /api/seasons/:id/participants).
 *
 * CA2 : un code invalide affiche un message d'erreur générique, sans fuite
 * d'information — le backend renvoie déjà un message neutre (404), repris
 * tel quel.
 */
import { Component, OnInit, WritableSignal, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { SeasonsService } from '../seasons.service';
import { SeasonSummary } from '../season.model';
import { TeamsService } from '../../teams/teams.service';
import { Team } from '../../teams/team.model';

@Component({
  selector: 'app-season-join',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './season-join.html',
  styleUrl: './season-join.scss',
})
export class SeasonJoin implements OnInit {
  private route: ActivatedRoute = inject(ActivatedRoute);
  private seasonsService: SeasonsService = inject(SeasonsService);
  private teamsService: TeamsService = inject(TeamsService);

  /** Code d'invitation lu depuis l'URL */
  private code: string = this.route.snapshot.params['code'];

  /** Vrai pendant le chargement du résumé de la saison */
  loading: WritableSignal<boolean> = signal(true);

  /** Message d'erreur générique si le code est invalide (CA2) */
  error: WritableSignal<string> = signal('');

  /** Résumé minimal de la saison (nom, état, organisateur) — null si non chargé */
  summary: WritableSignal<SeasonSummary | null> = signal<SeasonSummary | null>(null);

  /** Équipes de l'utilisateur connecté, pour le select */
  userTeams: WritableSignal<Team[]> = signal<Team[]>([]);

  /** Équipe sélectionnée pour la demande d'inscription */
  selectedTeamId: WritableSignal<number | null> = signal<number | null>(null);

  /** Vrai pendant l'appel API de demande d'inscription */
  submitting: WritableSignal<boolean> = signal(false);

  /** Message d'erreur lors de la soumission (CA4/CA5) */
  submitError: WritableSignal<string> = signal('');

  /** Vrai après une demande d'inscription réussie */
  submitted: WritableSignal<boolean> = signal(false);

  ngOnInit(): void {
    this.loadSummary();
    this.loadUserTeams();
  }

  private loadSummary(): void {
    this.loading.set(true);
    this.error.set('');

    this.seasonsService.getByCode(this.code).subscribe({
      next: (summary: SeasonSummary) => {
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Code d\'invitation invalide ou inexistant.');
        this.loading.set(false);
      },
    });
  }

  private loadUserTeams(): void {
    this.teamsService.getAll().subscribe({
      next: (teams: Team[]) => {
        this.userTeams.set(teams);
        if (teams.length > 0 && this.selectedTeamId() === null) {
          this.selectedTeamId.set(teams[0].id);
        }
      },
      error: () => this.userTeams.set([]),
    });
  }

  /** Soumet la demande d'inscription pour l'équipe sélectionnée. */
  submitJoinRequest(): void {
    const summary = this.summary();
    const teamId = this.selectedTeamId();
    if (!summary || teamId === null) {
      return;
    }

    this.submitting.set(true);
    this.submitError.set('');

    this.seasonsService.requestJoin(summary.id, { teamId }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.submitted.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.submitError.set(err.error?.message ?? 'Une erreur est survenue. Veuillez réessayer.');
        this.submitting.set(false);
      },
    });
  }
}
