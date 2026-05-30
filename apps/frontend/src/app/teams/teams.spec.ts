/**
 * Tests unitaires pour le composant Teams.
 *
 * On mock TeamsService pour ne pas effectuer de vraies requêtes HTTP.
 * On teste uniquement le comportement du composant :
 * - Affichage selon l'état (chargement, vide, liste)
 * - Ouverture/fermeture du formulaire
 * - Appel au service lors de la suppression
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Teams } from './teams';
import { TeamsService } from './teams.service';
import { Team } from './team.model';

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
      // Le composant est standalone → on l'importe directement
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

  it('affiche la liste des équipes après chargement', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const cards = compiled.querySelectorAll('.team-card');
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

  // ── Formulaire ─────────────────────────────────────────────────────────────

  it('n\'affiche pas le formulaire au démarrage', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.team-form-card')).toBeNull();
  });

  it('affiche le formulaire au clic sur "Nouvelle équipe"', () => {
    component.openCreate();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.team-form-card')).toBeTruthy();
  });

  it('masque le formulaire au clic sur "Annuler"', () => {
    component.openCreate();
    fixture.detectChanges();

    component.cancelForm();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.team-form-card')).toBeNull();
  });

  it('pré-remplit le formulaire lors de l\'édition d\'une équipe', () => {
    component.openEdit(mockTeams[0]);

    expect(component.formName()).toBe('Les Furieux du Désert');
    expect(component.formSponsor()).toBe('Rutherford');
    expect(component.formCans()).toBe(50);
    expect(component.editingTeam()).toEqual(mockTeams[0]);
  });

  // ── Suppression ────────────────────────────────────────────────────────────

  it('appelle TeamsService.remove() après confirmation et retire l\'équipe de la liste', () => {
    // Simule window.confirm → true
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

  it('affiche une erreur si on tente de sauvegarder un nom vide', () => {
    component.openCreate();
    component.formName.set('   '); // seulement des espaces

    component.saveForm();

    expect(component.error()).toContain('obligatoire');
    expect(mockTeamsService.create).not.toHaveBeenCalled();
  });
});
