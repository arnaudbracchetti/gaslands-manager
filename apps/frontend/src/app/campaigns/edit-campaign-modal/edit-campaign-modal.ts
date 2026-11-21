/**
 * EditCampaignModal — modification d'une campagne (organisateur uniquement).
 *
 * Composant **dumb** : reçoit la campagne courante, pré-remplit le formulaire
 * nom/budget et les règles maison cochées, valide localement (nom non vide)
 * puis émet un unique `EditCampaignSubmission` au clic sur "Enregistrer".
 * Contrairement à `ChangeTeamModal`, ne se ferme JAMAIS automatiquement sur
 * `confirmed` — c'est le parent (CampaignDetail) qui décide de la fermeture,
 * uniquement en cas de succès serveur, pour que l'erreur (`error` input)
 * reste visible et corrigeable sans rouvrir la modale.
 *
 * Nom/budget restent réservés à `EN_CONSTRUCTION` (`canEditNameBudget`, champs
 * désactivés sinon) — mais la modale elle-même reste accessible dans tout état
 * de la campagne : les règles maison (`HouseRulesSelector`) n'ont, elles,
 * aucune contrainte d'état (cf. spec/CAMPAIGN.md — Règles maison).
 *
 * **Un seul bouton, une seule sémantique** : contrairement à une précédente
 * version qui auto-sauvegardait chaque bascule de règle maison immédiatement
 * (et désactivait "Enregistrer" hors EN_CONSTRUCTION, laissant "Annuler" comme
 * seule sortie — ce qui persistait silencieusement les règles maison malgré
 * son nom), toute bascule ne modifie plus qu'un état LOCAL (`formHouseRules`,
 * même pattern que `CampaignForm`). Rien n'est envoyé au serveur avant le clic
 * sur "Enregistrer" ; "Annuler" ferme la modale sans rien persister, y compris
 * les règles maison basculées pendant la session — la réouverture de la
 * modale (composant recréé par le `@if` du parent) repart alors de l'état
 * serveur actuel. "Enregistrer" est donc toujours actif : il soumet toujours
 * les règles maison, et en plus nom/budget si `canEditNameBudget()`.
 */
import { Component, InputSignal, OutputEmitterRef, Signal, WritableSignal, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Campaign, EditCampaignSubmission, HouseRuleDefinition } from '../campaign.model';
import { Icon } from '../../shared/icon/icon';
import { ModalShell } from '../../shared/modal-shell/modal-shell';
import { HouseRulesSelector, HouseRuleToggledEvent } from '../house-rules-selector/house-rules-selector';

@Component({
  selector: 'app-edit-campaign-modal',
  standalone: true,
  imports: [FormsModule, Icon, ModalShell, HouseRulesSelector],
  templateUrl: './edit-campaign-modal.html',
  styleUrl: './edit-campaign-modal.scss',
})
export class EditCampaignModal {
  /** Campagne à modifier — sert de pré-remplissage. */
  campaign: InputSignal<Campaign> = input.required<Campaign>();

  /** Vrai pendant que le parent attend la réponse de l'API (nom/budget et/ou règles maison). */
  saving: InputSignal<boolean> = input(false);

  /** Message d'erreur serveur (nom/budget ou règles maison — une seule soumission désormais). */
  error: InputSignal<string> = input('');

  /** Catalogue des règles maison (GET /api/catalog/regles-maison). */
  houseRuleCatalog: InputSignal<HouseRuleDefinition[]> = input<HouseRuleDefinition[]>([]);

  /** Émis avec le DTO validé localement au clic "Enregistrer". */
  confirmed: OutputEmitterRef<EditCampaignSubmission> = output<EditCampaignSubmission>();

  /** Émis quand l'utilisateur annule — aucune bascule de règle maison n'est persistée. */
  cancelled: OutputEmitterRef<void> = output<void>();

  formName: WritableSignal<string> = signal('');
  formBudget: WritableSignal<number> = signal(1);

  /** État local des règles maison cochées — persisté uniquement au clic "Enregistrer". */
  formHouseRules: WritableSignal<string[]> = signal<string[]>([]);

  /** Erreur de validation locale (nom vide) — distincte de l'erreur serveur `error`. */
  formError: WritableSignal<string> = signal('');

  /** Erreur affichée : locale en priorité, sinon celle transmise par le parent. */
  displayError: Signal<string> = computed(() => this.formError() || this.error());

  /** Nom/budget ne sont modifiables qu'en construction — les règles maison, elles, le restent toujours. */
  canEditNameBudget: Signal<boolean> = computed(() => this.campaign().state === 'EN_CONSTRUCTION');

  constructor() {
    // Pré-remplit le formulaire depuis la campagne courante à chaque ouverture
    // (le parent recrée ce composant via @if à chaque ouverture de la modale,
    // donc cet effect ne s'exécute qu'une fois par session d'édition).
    effect(() => {
      const campaign = this.campaign();
      this.formName.set(campaign.name);
      this.formBudget.set(campaign.budget);
      this.formHouseRules.set(campaign.houseRules);
    });
  }

  /** Bascule une règle maison dans l'état local du formulaire — aucun appel réseau. */
  onHouseRuleToggled({ nomInterne, enabled }: HouseRuleToggledEvent): void {
    this.formHouseRules.update((keys) =>
      enabled ? [...keys, nomInterne] : keys.filter((k) => k !== nomInterne),
    );
  }

  onConfirm(): void {
    const houseRules = this.formHouseRules();

    if (!this.canEditNameBudget()) {
      this.formError.set('');
      this.confirmed.emit({ nameBudget: null, houseRules });
      return;
    }

    const name = this.formName().trim();
    if (!name) {
      this.formError.set('Le nom de la saison est obligatoire.');
      return;
    }
    this.formError.set('');
    this.confirmed.emit({ nameBudget: { name, budget: this.formBudget() }, houseRules });
  }
}
