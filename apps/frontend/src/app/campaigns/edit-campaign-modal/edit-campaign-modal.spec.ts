/**
 * Tests unitaires pour EditCampaignModal (composant dumb).
 *
 * Vérifie le pré-remplissage depuis `campaign`, la validation locale (nom
 * obligatoire), l'émission du DTO au clic Enregistrer, l'émission de
 * `cancelled` au clic Annuler, et l'affichage de l'erreur (locale prioritaire
 * sur l'erreur serveur transmise par le parent).
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { EditCampaignModal } from './edit-campaign-modal';
import type { Campaign, UpdateCampaignDto } from '../campaign.model';

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
};

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
});
