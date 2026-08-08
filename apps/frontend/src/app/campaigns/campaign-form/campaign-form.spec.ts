/**
 * Tests unitaires pour CampaignForm.
 *
 * Composant "dumb" : on vérifie
 * - la validation locale (nom obligatoire)
 * - l'émission du bon DTO lors de la sauvegarde
 * - l'émission de formCancel au clic sur Annuler
 * - le comportement CA3 : aucune équipe disponible → message + soumission désactivée
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { CampaignForm } from './campaign-form';
import { Team, CreateTeamDto } from '../../teams/team.model';
import { CreateCampaignDto } from '../campaign.model';

const mockTeams: Team[] = [
  {
    id: 7,
    name: 'Les Furieux du Désert',
    sponsor: 'Rutherford',
    cans: 50,
    userId: 42,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    vehiclesCost: 30,
  },
  {
    id: 8,
    name: 'Brigade de l\'Asphalte',
    sponsor: 'Miyazaki',
    cans: 60,
    userId: 42,
    createdAt: '2025-01-02T00:00:00.000Z',
    updatedAt: '2025-01-02T00:00:00.000Z',
    vehiclesCost: 70,
  },
];

describe('CampaignForm', () => {
  let component: CampaignForm;
  let fixture: ComponentFixture<CampaignForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CampaignForm],
    }).compileComponents();

    fixture = TestBed.createComponent(CampaignForm);
    component = fixture.componentInstance;
  });

  // ── Pré-sélection ─────────────────────────────────────────────────────────

  it('ne pré-sélectionne pas d\'équipe par défaut (teamId optionnel)', () => {
    fixture.componentRef.setInput('teams', mockTeams);
    fixture.detectChanges();

    expect(component.formTeamId()).toBeNull();
  });

  // ── Validation ────────────────────────────────────────────────────────────

  it('refuse la sauvegarde si le nom est vide', () => {
    fixture.componentRef.setInput('teams', mockTeams);
    fixture.detectChanges();

    const emitted: CreateCampaignDto[] = [];
    outputToObservable(component.saved).subscribe((dto) => emitted.push(dto));

    component.formName.set('   ');
    component.saveForm();

    expect(emitted).toHaveLength(0);
    expect(component.formError()).toContain('obligatoire');
  });

  // ── Émission du DTO ──────────────────────────────────────────────────────

  it('émet le DTO validé avec le nom, le budget et l\'équipe choisie', () => {
    fixture.componentRef.setInput('teams', mockTeams);
    fixture.detectChanges();

    const emitted: CreateCampaignDto[] = [];
    outputToObservable(component.saved).subscribe((dto) => emitted.push(dto));

    component.formName.set('Coupe Verney');
    component.formTeamId.set(7);  // vehiclesCost 30 ≤ budget par défaut 50
    component.saveForm();

    expect(emitted).toEqual([{ name: 'Coupe Verney', budget: 50, teamId: 7 }]);
  });

  // ── Budget des équipes (éligibilité) ─────────────────────────────────────

  describe('ineligibleTeamIds', () => {
    it('grise les équipes dont le coût cumulé dépasse le budget saisi', () => {
      fixture.componentRef.setInput('teams', mockTeams);
      fixture.detectChanges();

      component.formBudget.set(50);

      expect(component.ineligibleTeamIds().has(7)).toBe(false);  // 30 ≤ 50
      expect(component.ineligibleTeamIds().has(8)).toBe(true);   // 70 > 50
    });

    it('recalcule dynamiquement quand le budget saisi change', () => {
      fixture.componentRef.setInput('teams', mockTeams);
      fixture.detectChanges();

      component.formBudget.set(80);
      expect(component.ineligibleTeamIds().has(8)).toBe(false);  // 70 ≤ 80

      component.formBudget.set(20);
      expect(component.ineligibleTeamIds().has(7)).toBe(true);   // 30 > 20
    });

    it('refuse la sauvegarde si l\'équipe choisie est hors budget', () => {
      fixture.componentRef.setInput('teams', mockTeams);
      fixture.detectChanges();

      const emitted: CreateCampaignDto[] = [];
      outputToObservable(component.saved).subscribe((dto) => emitted.push(dto));

      component.formName.set('Coupe Verney');
      component.formBudget.set(50);
      component.formTeamId.set(8);  // 70 > 50
      component.saveForm();

      expect(emitted).toHaveLength(0);
      expect(component.formError()).toContain('budget');
    });
  });

  // ── Annulation ────────────────────────────────────────────────────────────

  it('émet formCancel au clic sur Annuler', () => {
    fixture.componentRef.setInput('teams', mockTeams);
    fixture.detectChanges();

    let cancelled = false;
    outputToObservable(component.formCancel).subscribe(() => { cancelled = true; });

    component.cancelForm();

    expect(cancelled).toBe(true);
  });

  // ── Création rapide d'équipe (QuickTeamCreate) ───────────────────────────

  it('relaie la création rapide d\'équipe au parent via teamCreated', () => {
    fixture.componentRef.setInput('teams', mockTeams);
    fixture.detectChanges();

    const emitted: CreateTeamDto[] = [];
    outputToObservable(component.teamCreated).subscribe((dto) => emitted.push(dto));

    const dto: CreateTeamDto = { name: 'Équipe du Vendredi', sponsor: 'Rutherford', cans: 50 };
    component.teamCreated.emit(dto);

    expect(emitted).toEqual([dto]);
  });

  it('sélectionne automatiquement la nouvelle équipe ajoutée à teams', () => {
    fixture.componentRef.setInput('teams', mockTeams);
    fixture.detectChanges();

    expect(component.formTeamId()).toBeNull();

    const newTeam: Team = {
      id: 9,
      name: 'Équipe du Vendredi',
      sponsor: 'Rutherford',
      cans: 50,
      userId: 42,
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    };
    fixture.componentRef.setInput('teams', [...mockTeams, newTeam]);
    fixture.detectChanges();

    expect(component.formTeamId()).toBe(9);
  });

  it('affiche le bouton de création rapide même quand l\'utilisateur n\'a aucune équipe', () => {
    fixture.componentRef.setInput('teams', []);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-quick-team-create')).not.toBeNull();
  });
});
