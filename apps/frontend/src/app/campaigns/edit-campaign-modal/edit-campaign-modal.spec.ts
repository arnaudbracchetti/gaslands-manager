/**
 * Tests unitaires pour EditCampaignModal (composant dumb).
 *
 * Vérifie le pré-remplissage depuis `campaign`, la validation locale (nom
 * obligatoire), l'émission du DTO au clic Enregistrer, l'émission de
 * `cancelled` au clic Annuler, l'affichage de l'erreur (locale prioritaire
 * sur l'erreur serveur transmise par le parent), la désactivation de nom/
 * budget hors EN_CONSTRUCTION, et la bascule des règles maison (auto-save,
 * aucune contrainte d'état).
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { EditCampaignModal } from './edit-campaign-modal';
import type { Campaign, UpdateCampaignDto, HouseRuleDefinition } from '../campaign.model';
import type { HouseRuleToggledEvent } from '../house-rules-selector/house-rules-selector';

const mockCampaign: Campaign = {
  id: 1,
  name: 'Coupe Verney',
  state: 'EN_CONSTRUCTION',
  inviteCode: 'invite-code',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  participantCount: 2,
  myRole: 'organizer',
  budget: 50,
  houseRules: [],
};

const mockHouseRules: HouseRuleDefinition[] = [
  {
    nom: 'Aucun point de championnat',
    nom_interne: 'resistance_sans_points_championnat',
    description_decochee: '<p>Décoché.</p>',
    description_cochee: '<p>Coché.</p>',
  },
];

describe('EditCampaignModal', () => {
  let component: EditCampaignModal;
  let fixture: ComponentFixture<EditCampaignModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EditCampaignModal] }).compileComponents();
    fixture = TestBed.createComponent(EditCampaignModal);
    component = fixture.componentInstance;
  });

  it('pré-remplit le formulaire depuis la campagne fournie', () => {
    fixture.componentRef.setInput('campaign', mockCampaign);
    fixture.detectChanges();

    expect(component.formName()).toBe('Coupe Verney');
    expect(component.formBudget()).toBe(50);
  });

  it('resynchronise le formulaire quand la campagne change', () => {
    fixture.componentRef.setInput('campaign', mockCampaign);
    fixture.detectChanges();

    fixture.componentRef.setInput('campaign', { ...mockCampaign, name: 'Coupe Rutherford', budget: 80 });
    fixture.detectChanges();

    expect(component.formName()).toBe('Coupe Rutherford');
    expect(component.formBudget()).toBe(80);
  });

  it('refuse la confirmation si le nom est vide', () => {
    fixture.componentRef.setInput('campaign', mockCampaign);
    fixture.detectChanges();

    const emitted: UpdateCampaignDto[] = [];
    outputToObservable(component.confirmed).subscribe((dto) => emitted.push(dto));

    component.formName.set('   ');
    component.onConfirm();

    expect(emitted).toHaveLength(0);
    expect(component.formError()).toContain('obligatoire');
  });

  it('émet confirmed avec le nom trimmé et le budget saisi', () => {
    fixture.componentRef.setInput('campaign', mockCampaign);
    fixture.detectChanges();

    const emitted: UpdateCampaignDto[] = [];
    outputToObservable(component.confirmed).subscribe((dto) => emitted.push(dto));

    component.formName.set('  Coupe Rutherford  ');
    component.formBudget.set(30);
    component.onConfirm();

    expect(emitted).toEqual([{ name: 'Coupe Rutherford', budget: 30 }]);
  });

  it('émet cancelled au clic sur Annuler', () => {
    fixture.componentRef.setInput('campaign', mockCampaign);
    fixture.detectChanges();

    let cancelled = false;
    outputToObservable(component.cancelled).subscribe(() => { cancelled = true; });

    (fixture.nativeElement.querySelector('.ms-modal__cancel') as HTMLElement).click();

    expect(cancelled).toBe(true);
  });

  it('affiche l\'erreur serveur transmise par le parent', () => {
    fixture.componentRef.setInput('campaign', mockCampaign);
    fixture.componentRef.setInput('error', 'L\'équipe « Escouade » coûte 40 jerricans, au-delà du budget de la campagne (30).');
    fixture.detectChanges();

    expect(component.displayError()).toContain('Escouade');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Escouade');
  });

  it('priorise l\'erreur de validation locale sur l\'erreur serveur', () => {
    fixture.componentRef.setInput('campaign', mockCampaign);
    fixture.componentRef.setInput('error', 'Erreur serveur.');
    fixture.detectChanges();

    component.formName.set('');
    component.onConfirm();
    fixture.detectChanges();

    expect(component.displayError()).toContain('obligatoire');
  });

  // ── Nom/budget réservés à EN_CONSTRUCTION ────────────────────────────────

  it('active les champs nom/budget quand la campagne est EN_CONSTRUCTION', () => {
    fixture.componentRef.setInput('campaign', mockCampaign);
    fixture.detectChanges();

    expect(component.canEditNameBudget()).toBe(true);
    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('#edit-campaign-name');
    expect(nameInput.readOnly).toBe(false);
  });

  it('rend nom/budget en lecture seule et affiche une note hors EN_CONSTRUCTION', () => {
    fixture.componentRef.setInput('campaign', { ...mockCampaign, state: 'EN_COURS' });
    fixture.detectChanges();

    expect(component.canEditNameBudget()).toBe(false);
    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('#edit-campaign-name');
    const budgetInput: HTMLInputElement = fixture.nativeElement.querySelector('#edit-campaign-budget');
    expect(nameInput.readOnly).toBe(true);
    expect(budgetInput.readOnly).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('ne sont modifiables qu\'en construction');
  });

  it('désactive le bouton Enregistrer hors EN_CONSTRUCTION, pour ne jamais soumettre un nom/budget inchangés', () => {
    fixture.componentRef.setInput('campaign', { ...mockCampaign, state: 'EN_COURS' });
    fixture.detectChanges();

    const confirmBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.ms-modal__confirm');
    expect(confirmBtn.disabled).toBe(true);
  });

  it('garde le bouton Enregistrer actif quand la campagne est EN_CONSTRUCTION', () => {
    fixture.componentRef.setInput('campaign', mockCampaign);
    fixture.detectChanges();

    const confirmBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.ms-modal__confirm');
    expect(confirmBtn.disabled).toBe(false);
  });

  // ── Règles maison (auto-save, aucune contrainte d'état) ──────────────────

  it('passe les règles maison actives de la campagne à HouseRulesSelector', () => {
    fixture.componentRef.setInput('campaign', { ...mockCampaign, houseRules: ['resistance_sans_points_championnat'] });
    fixture.componentRef.setInput('houseRuleCatalog', mockHouseRules);
    fixture.detectChanges();

    const checkbox: HTMLInputElement = fixture.nativeElement.querySelector('input[type="checkbox"]');
    expect(checkbox.checked).toBe(true);
  });

  it('émet houseRuleToggled au clic sur une règle maison', () => {
    fixture.componentRef.setInput('campaign', mockCampaign);
    fixture.componentRef.setInput('houseRuleCatalog', mockHouseRules);
    fixture.detectChanges();

    const emitted: HouseRuleToggledEvent[] = [];
    outputToObservable(component.houseRuleToggled).subscribe((e) => emitted.push(e));

    fixture.nativeElement.querySelector('input[type="checkbox"]').click();
    fixture.detectChanges();

    expect(emitted).toEqual([{ nomInterne: 'resistance_sans_points_championnat', enabled: true }]);
  });

  it('reste modifiable pour les règles maison même hors EN_CONSTRUCTION', () => {
    fixture.componentRef.setInput('campaign', { ...mockCampaign, state: 'TERMINEE' });
    fixture.componentRef.setInput('houseRuleCatalog', mockHouseRules);
    fixture.detectChanges();

    const checkbox: HTMLInputElement = fixture.nativeElement.querySelector('input[type="checkbox"]');
    expect(checkbox.disabled).toBe(false);
  });

  it('désactive les règles maison quand savingHouseRules est vrai', () => {
    fixture.componentRef.setInput('campaign', mockCampaign);
    fixture.componentRef.setInput('houseRuleCatalog', mockHouseRules);
    fixture.componentRef.setInput('savingHouseRules', true);
    fixture.detectChanges();

    const checkbox: HTMLInputElement = fixture.nativeElement.querySelector('input[type="checkbox"]');
    expect(checkbox.disabled).toBe(true);
  });

  it('affiche l\'erreur serveur dédiée aux règles maison', () => {
    fixture.componentRef.setInput('campaign', mockCampaign);
    fixture.componentRef.setInput('houseRulesError', 'Erreur lors de la sauvegarde des règles maison.');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Erreur lors de la sauvegarde des règles maison.');
  });
});
