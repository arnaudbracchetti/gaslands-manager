/**
 * Tests unitaires pour le composant orchestrateur Teams.
 *
 * Teams est désormais un composant "smart" qui délègue l'affichage
 * à TeamCard et TeamForm. On teste ici uniquement son rôle d'orchestration :
 * - Chargement de la liste via TeamsService
 * - Contrôle de la visibilité du formulaire
 * - Appel au service lors de onSaved() et deleteTeam()
 * - Gestion des erreurs API
 *
 * Les tests du comportement interne des cartes et du formulaire
 * sont dans leurs specs respectives :
 *   - team-card/team-card.spec.ts
 *   - team-form/team-form.spec.ts
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Teams } from './teams';
import { TeamsService } from './teams.service';
import { Team, CreateTeamDto } from './team.model';

// Équipes fictives
const mockTeams: Team[] = [
  {
    id: 1,
    name: 'Les Furieux du Désert',
    sponsor: 'Rutherford',
    cans: 50,
    userId: 42,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    name: 'Brigade de l\'Asphalte',
    sponsor: 'Miyazaki',
    cans: 60,
    userId: 42,
    createdAt: '2025-01-02T00:00:00.000Z',
    updatedAt: '2025-01-02T00:00:00.000Z',
  },
];

describe('Teams Component', () => {
  let component: Teams;
  let fixture: ComponentFixture<Teams>;
  let mockTeamsService: {
    getAll: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockTeamsService = {
      getAll: vi.fn().mockReturnValue(of(mockTeams)),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    await TestBed.configureTestingModule({
      // Le composant est standalone → on l'importe directement.
      // TeamCard et TeamForm seront rendus dans le DOM (test d'intégration légère).
      imports: [Teams],
      providers: [
        provideRouter([]),
        { provide: TeamsService, useValue: mockTeamsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Teams);
    component = fixture.componentInstance;
    // detectChanges() déclenche ngOnInit → charge les équipes
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  // ── Chargement initial ─────────────────────────────────────────────────────

  it('appelle TeamsService.getAll() au démarrage', () => {
    expect(mockTeamsService.getAll).toHaveBeenCalledTimes(1);
  });

  it('affiche les cartes des équipes après chargement', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    // Les cartes sont rendues par TeamCard — on vérifie les sélecteurs du composant
    const cards = compiled.querySelectorAll('app-team-card');
    expect(cards.length).toBe(2);
    expect(compiled.textContent).toContain('Les Furieux du Désert');
    expect(compiled.textContent).toContain('Brigade de l\'Asphalte');
  });

  // ── État vide ──────────────────────────────────────────────────────────────

  it('affiche un message d\'état vide si aucune équipe', () => {
    mockTeamsService.getAll.mockReturnValue(of([]));

    component.ngOnInit();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.teams-empty')).toBeTruthy();
    expect(compiled.textContent).toContain('Aucune équipe');
  });

  // ── Contrôle du formulaire ─────────────────────────────────────────────────

  it('n\'affiche pas le formulaire au démarrage', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-team-form')).toBeNull();
  });

  it('affiche le formulaire au clic sur "Nouvelle équipe"', () => {
    component.openCreate();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-team-form')).toBeTruthy();
  });

  it('masque le formulaire au clic sur "Annuler"', () => {
    component.openCreate();
    fixture.detectChanges();

    component.cancelForm();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-team-form')).toBeNull();
  });

  it('openCreate() positionne editingTeam à null et showForm à true', () => {
    component.openCreate();
    expect(component.editingTeam()).toBeNull();
    expect(component.showForm()).toBe(true);
  });

  it('openEdit(team) positionne editingTeam et showForm à true', () => {
    component.openEdit(mockTeams[0]);
    expect(component.editingTeam()).toEqual(mockTeams[0]);
    expect(component.showForm()).toBe(true);
  });

  // ── Sauvegarde (onSaved) ───────────────────────────────────────────────────

  it('appelle create() quand onSaved() est appelé en mode création', () => {
    mockTeamsService.create.mockReturnValue(of(mockTeams[0]));
    mockTeamsService.getAll.mockReturnValue(of(mockTeams));

    component.openCreate(); // editingTeam = null
    const dto: CreateTeamDto = { name: 'Nouvelle', sponsor: 'Idris', cans: 50 };
    component.onSaved(dto);

    expect(mockTeamsService.create).toHaveBeenCalledWith(dto);
    expect(mockTeamsService.update).not.toHaveBeenCalled();
  });

  it('appelle update() quand onSaved() est appelé en mode édition', () => {
    mockTeamsService.update.mockReturnValue(of(mockTeams[0]));
    mockTeamsService.getAll.mockReturnValue(of(mockTeams));

    component.openEdit(mockTeams[0]); // editingTeam = mockTeams[0]
    const dto: CreateTeamDto = { name: 'Modifiée', sponsor: 'Idris', cans: 50 };
    component.onSaved(dto);

    expect(mockTeamsService.update).toHaveBeenCalledWith(1, dto);
    expect(mockTeamsService.create).not.toHaveBeenCalled();
  });

  it('ferme le formulaire après une sauvegarde réussie', () => {
    mockTeamsService.create.mockReturnValue(of(mockTeams[0]));
    mockTeamsService.getAll.mockReturnValue(of(mockTeams));

    component.openCreate();
    component.onSaved({ name: 'Test', sponsor: 'Rutherford', cans: 50 });
    fixture.detectChanges();

    expect(component.showForm()).toBe(false);
    expect(component.editingTeam()).toBeNull();
  });

  it('affiche une erreur API si la sauvegarde échoue', () => {
    mockTeamsService.create.mockReturnValue(throwError(() => new Error('API error')));

    component.openCreate();
    component.onSaved({ name: 'Test', sponsor: 'Rutherford', cans: 50 });

    expect(component.error()).toContain('erreur');
    expect(component.showForm()).toBe(true); // le formulaire reste ouvert
  });

  // ── Suppression ────────────────────────────────────────────────────────────

  it('appelle TeamsService.remove() après confirmation et retire l\'équipe de la liste', () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    mockTeamsService.remove.mockReturnValue(of(undefined));

    component.deleteTeam(mockTeams[0]);

    expect(mockTeamsService.remove).toHaveBeenCalledWith(1);
    // La suppression optimiste retire immédiatement l'équipe du signal
    expect(component.teams().find((t) => t.id === 1)).toBeUndefined();

    vi.unstubAllGlobals();
  });

  it('n\'appelle pas remove() si l\'utilisateur annule la confirmation', () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));

    component.deleteTeam(mockTeams[0]);

    expect(mockTeamsService.remove).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  // ── Gestion d'erreur ───────────────────────────────────────────────────────

  it('affiche un message d\'erreur si le chargement échoue', () => {
    mockTeamsService.getAll.mockReturnValue(throwError(() => new Error('Network error')));

    component.ngOnInit();
    fixture.detectChanges();

    expect(component.error()).toContain('Impossible de charger');

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.teams-error')).toBeTruthy();
  });
});
