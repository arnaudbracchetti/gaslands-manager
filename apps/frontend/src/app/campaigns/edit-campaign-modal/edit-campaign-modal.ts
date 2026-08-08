/**
 * EditCampaignModal — modification du nom et du budget d'une campagne
 * EN_CONSTRUCTION (organisateur uniquement).
 *
 * Composant **dumb** : reçoit la campagne courante, pré-remplit le formulaire,
 * valide localement (nom non vide) puis émet un `UpdateCampaignDto`. Contrairement
 * à `ChangeTeamModal`, ne se ferme JAMAIS automatiquement sur `confirmed` — c'est
 * le parent (CampaignDetail) qui décide de la fermeture, uniquement en cas de
 * succès serveur, pour que l'erreur de budget (`error` input) reste visible et
 * corrigeable sans rouvrir la modale.
 */
import { Component, InputSignal, OutputEmitterRef, Signal, WritableSignal, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Campaign, UpdateCampaignDto } from '../campaign.model';
import { Icon } from '../../shared/icon/icon';
import { ModalShell } from '../../shared/modal-shell/modal-shell';

@Component({
  selector: 'app-edit-campaign-modal',
  standalone: true,
  imports: [FormsModule, Icon, ModalShell],
  templateUrl: './edit-campaign-modal.html',
  styleUrl: './edit-campaign-modal.scss',
})
export class EditCampaignModal {
  /** Campagne à modifier — sert de pré-remplissage. */
  campaign: InputSignal<Campaign> = input.required<Campaign>();

  /** Vrai pendant que le parent attend la réponse de l'API. */
  saving: InputSignal<boolean> = input(false);

  /** Message d'erreur serveur (ex. budget trop bas pour une équipe déjà engagée). */
  error: InputSignal<string> = input('');

  /** Émis avec le DTO validé localement. */
  confirmed: OutputEmitterRef<UpdateCampaignDto> = output<UpdateCampaignDto>();

  /** Émis quand l'utilisateur annule sans modifier. */
  cancelled: OutputEmitterRef<void> = output<void>();

  formName: WritableSignal<string> = signal('');
  formBudget: WritableSignal<number> = signal(1);

  /** Erreur de validation locale (nom vide) — distincte de l'erreur serveur `error`. */
  formError: WritableSignal<string> = signal('');

  /** Erreur affichée : locale en priorité, sinon celle transmise par le parent. */
  displayError: Signal<string> = computed(() => this.formError() || this.error());

  constructor() {
    // Pré-remplit le formulaire depuis la campagne courante à chaque ouverture.
    effect(() => {
      const campaign = this.campaign();
      this.formName.set(campaign.name);
      this.formBudget.set(campaign.budget);
    });
  }

  onConfirm(): void {
    const name = this.formName().trim();
    if (!name) {
      this.formError.set('Le nom de la saison est obligatoire.');
      return;
    }
    this.formError.set('');
    this.confirmed.emit({ name, budget: this.formBudget() });
  }
}
