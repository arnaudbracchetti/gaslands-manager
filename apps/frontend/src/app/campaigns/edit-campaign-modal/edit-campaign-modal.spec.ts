/**
 * Tests unitaires pour EditCampaignModal (composant dumb).
 *
 * Vérifie le pré-remplissage depuis `campaign` (nom/budget/règles maison), la
 * validation locale (nom obligatoire), l'émission d'un unique
 * `EditCampaignSubmission` au clic Enregistrer (nom/budget + règles maison en
 * EN_CONSTRUCTION, règles maison seules sinon), l'émission de `cancelled` au
 * clic Annuler sans rien émettre, l'affichage de l'erreur (locale prioritaire
 * sur l'erreur serveur transmise par le parent), la désactivation de nom/
 * budget hors EN_CONSTRUCTION, et la bascule purement locale des règles
 * maison (aucun appel réseau avant "Enregistrer").
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { EditCampaignModal } from './edit-campaign-modal';
import type { Campaign, EditCampaignSubmission, HouseRuleDefinition } from '../campaign.model';

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
    expect(component.formHouseRules()).toEqual([]);
  });

  it('resynchronise le formulaire quand la campagne change', () => {
    fixture.componentRef.setInput('campaign', mockCampaign);
    fixture.detectChanges();

    fixture.componentRef.setInput('campaign', {
      ...mockCampaign,
      name: 'Coupe Rutherford',
      budget: 80,
      houseRules: ['resistance_sans_points_championnat'],
    });
    fixture.detectChanges();

    expect(component.formName()).toBe('Coupe Rutherford');
    expect(component.formBudget()).toBe(80);
    expect(component.formHouseRules()).toEqual(['resistance_sans_points_championnat']);
  });

  it('refuse la confirmation si le nom est vide', () => {
    fixture.componentRef.setInput('campaign', mockCampaign);
    fixture.detectChanges();

    const emitted: EditCampaignSubmission[] = [];
    outputToObservable(component.confirmed).subscribe((dto) => emitted.push(dto));

    component.formName.set('   ');
    component.onConfirm();

    expect(emitted).toHaveLength(0);
    expect(component.formError()).toContain('obligatoire');
  });

  it('émet confirmed avec le nom trimmé, le budget saisi et les règles maison', () => {
    fixture.componentRef.setInput('campaign', mockCampaign);
    fixture.componentRef.setInput('houseRuleCatalog', mockHouseRules);
    fixture.detectChanges();

    const emitted: EditCampaignSubmission[] = [];
    outputToObservable(component.confirmed).subscribe((dto) => emitted.push(dto));

    component.formName.set('  Coupe Rutherford  ');
    component.formBudget.set(30);
    component.onHouseRuleToggled({ nomInterne: 'resistance_sans_points_championnat', enabled: true });
    component.onConfirm();

    expect(emitted).toEqual([{
      nameBudget: { name: 'Coupe Rutherford', budget: 30 },
      houseRules: ['resistance_sans_points_championnat'],
    }]);
  });

  it('émet confirmed avec nameBudget à null hors EN_CONSTRUCTION', () => {
    fixture.componentRef.setInput('campaign', { ...mockCampaign, state: 'EN_COURS' });
    fixture.componentRef.setInput('houseRuleCatalog', mockHouseRules);
    fixture.detectChanges();

    const emitted: EditCampaignSubmission[] = [];
    outputToObservable(component.confirmed).subscribe((dto) => emitted.push(dto));

    component.onHouseRuleToggled({ nomInterne: 'resistance_sans_points_championnat', enabled: true });
    component.onConfirm();

    expect(emitted).toEqual([{
      nameBudget: null,
      houseRules: ['resistance_sans_points_championnat'],
    }]);
  });

  it('émet cancelled au clic sur Annuler sans émettre confirmed', () => {
    fixture.componentRef.setInput('campaign', mockCampaign);
    fixture.componentRef.setInput('houseRuleCatalog', mockHouseRules);
    fixture.detectChanges();

    let cancelled = false;
    outputToObservable(component.cancelled).subscribe(() => { cancelled = true; });
    const emitted: EditCampaignSubmission[] = [];
    outputToObservable(component.confirmed).subscribe((dto) => emitted.push(dto));

    component.onHouseRuleToggled({ nomInterne: 'resistance_sans_points_championnat', enabled: true });
    (fixture.nativeElement.querySelector('.ms-modal__cancel') as HTMLElement).click();

    expect(cancelled).toBe(true);
    expect(emitted).toHaveLength(0);
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

  it('garde le bouton Enregistrer actif hors EN_CONSTRUCTION — il ne soumet alors que les règles maison', () => {
    fixture.componentRef.setInput('campaign', { ...mockCampaign, state: 'EN_COURS' });
    fixture.detectChanges();

    const confirmBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.ms-modal__confirm');
    expect(confirmBtn.disabled).toBe(false);
  });

  it('garde le bouton Enregistrer actif quand la campagne est EN_CONSTRUCTION', () => {
    fixture.componentRef.setInput('campaign', mockCampaign);
    fixture.detectChanges();

    const confirmBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.ms-modal__confirm');
    expect(confirmBtn.disabled).toBe(false);
  });

  it('désactive le bouton Enregistrer pendant la sauvegarde', () => {
    fixture.componentRef.setInput('campaign', mockCampaign);
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();

    const confirmBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.ms-modal__confirm');
    expect(confirmBtn.disabled).toBe(true);
  });

  // ── Règles maison (état local, persistées seulement au clic Enregistrer) ─

  it('passe les règles maison actives de la campagne à HouseRulesSelector', () => {
    fixture.componentRef.setInput('campaign', { ...mockCampaign, houseRules: ['resistance_sans_points_championnat'] });
    fixture.componentRef.setInput('houseRuleCatalog', mockHouseRules);
    fixture.detectChanges();

    const checkbox: HTMLInputElement = fixture.nativeElement.querySelector('input[type="checkbox"]');
    expect(checkbox.checked).toBe(true);
  });

  it('met à jour formHouseRules localement au clic sur une règle maison, sans émettre confirmed', () => {
    fixture.componentRef.setInput('campaign', mockCampaign);
    fixture.componentRef.setInput('houseRuleCatalog', mockHouseRules);
    fixture.detectChanges();

    const emitted: EditCampaignSubmission[] = [];
    outputToObservable(component.confirmed).subscribe((dto) => emitted.push(dto));

    fixture.nativeElement.querySelector('input[type="checkbox"]').click();
    fixture.detectChanges();

    expect(component.formHouseRules()).toEqual(['resistance_sans_points_championnat']);
    expect(emitted).toHaveLength(0);
  });

  it('reste modifiable pour les règles maison même hors EN_CONSTRUCTION', () => {
    fixture.componentRef.setInput('campaign', { ...mockCampaign, state: 'TERMINEE' });
    fixture.componentRef.setInput('houseRuleCatalog', mockHouseRules);
    fixture.detectChanges();

    const checkbox: HTMLInputElement = fixture.nativeElement.querySelector('input[type="checkbox"]');
    expect(checkbox.disabled).toBe(false);
  });

  it('désactive les règles maison pendant la sauvegarde', () => {
    fixture.componentRef.setInput('campaign', mockCampaign);
    fixture.componentRef.setInput('houseRuleCatalog', mockHouseRules);
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();

    const checkbox: HTMLInputElement = fixture.nativeElement.querySelector('input[type="checkbox"]');
    expect(checkbox.disabled).toBe(true);
  });
});
