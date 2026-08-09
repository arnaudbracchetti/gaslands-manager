/**
 * Tests unitaires pour ParticipantAtelierPage — consultation en lecture seule
 * de l'atelier d'un AUTRE participant (`/campaigns/:id/participants/:pid/atelier`).
 *
 * Ce qui est testé :
 *   - chargement du workshop (via `getParticipantWorkshop`) + catalogue sponsor
 *     + nom de campagne/participant (fil d'Ariane, en-tête)
 *   - sélection automatique du premier véhicule, puis changement de sélection
 *   - synthèse de budget (total/consommé)
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ParticipantAtelierPage } from './participant-atelier-page';
import { CampaignsService } from '../campaigns.service';
import { CatalogService } from '../../catalog/catalog.service';
import { Sponsor, Vehicule } from '../../catalog/catalog.model';
import { Campaign } from '../campaign.model';
import { CampaignParticipant } from '../campaign-participant.model';
import { WorkshopStateDto } from '../workshop.model';

const mockCampaign: Campaign = {
  id: 3,
  name: 'Les Terres Brûlées',
  state: 'EN_COURS',
  inviteCode: 'ABC123',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  participantCount: 2,
  budget: 50,
  myRole: 'participant',
};

const mockParticipants: CampaignParticipant[] = [
  { id: 1, userId: 42, teamId: 7, status: 'VALIDATED', isOrganizer: true, userName: 'Jean Dupont', teamName: 'Furies' },
  { id: 2, userId: 43, teamId: 8, status: 'VALIDATED', isOrganizer: false, userName: 'Alice Martin', teamName: 'Scrap Kings' },
];

const mockVehicule: Vehicule = {
  nom: 'Camion',
  nom_interne: 'camion',
  poids: 'Moyen',
  carrosserie: 12,
  manoeuvrabilite: 1,
  vitesse_max: 5,
  equipage: 2,
  emplacements: 4,
  prix: 16,
  description: 'Un poids lourd polyvalent.',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

const mockSponsorCatalog: Sponsor = {
  nom: 'Rutherford',
  description: 'Sponsor militaire.',
  classes_avantage: ['Militaire'],
  avantages_sponsorises: '',
  vehicules: [mockVehicule],
  armes: [],
  ameliorations: [],
  avantages: [],
};

const mockWorkshop: WorkshopStateDto = {
  participantId: 2,
  sponsor: 'Rutherford',
  wallet: 10,
  championshipPoints: 0,
  sabotagePoints: null,
  vehicles: [
    {
      id: 5,
      nomInterne: 'camion',
      nom: 'Camion',
      customName: null,
      price: 16,
      isLost: false,
      isSold: false,
      chocs: 0,
      sequellas: [],
      weapons: [],
      improvements: [],
      advantages: [],
      resaleRefund: 8,
      chassisResaleRefund: 8,
      purchasedThisSession: false,
      emplacementsTotal: 4,
    },
    {
      id: 6,
      nomInterne: 'camion',
      nom: 'La Teigne (Camion)',
      customName: 'La Teigne',
      price: 16,
      isLost: false,
      isSold: false,
      chocs: 0,
      sequellas: [],
      weapons: [],
      improvements: [],
      advantages: [],
      resaleRefund: 8,
      chassisResaleRefund: 8,
      purchasedThisSession: false,
      emplacementsTotal: 4,
    },
  ],
};

describe('ParticipantAtelierPage', () => {
  let fixture: ComponentFixture<ParticipantAtelierPage>;
  let component: ParticipantAtelierPage;
  let mockCampaignsService: {
    getOne: ReturnType<typeof vi.fn>;
    getParticipants: ReturnType<typeof vi.fn>;
    getParticipantWorkshop: ReturnType<typeof vi.fn>;
  };
  let mockCatalogService: { getSponsorByName: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockCampaignsService = {
      getOne: vi.fn().mockReturnValue(of(mockCampaign)),
      getParticipants: vi.fn().mockReturnValue(of(mockParticipants)),
      getParticipantWorkshop: vi.fn().mockReturnValue(of(mockWorkshop)),
    };
    mockCatalogService = {
      getSponsorByName: vi.fn().mockReturnValue(of(mockSponsorCatalog)),
    };
  });

  afterEach(() => vi.clearAllMocks());

  function createFixture(campaignId: string, participantId: string): void {
    const activatedRouteMock = {
      snapshot: { params: { id: campaignId, pid: participantId } },
    };

    TestBed.configureTestingModule({
      imports: [ParticipantAtelierPage],
      providers: [
        provideRouter([]),
        { provide: CampaignsService, useValue: mockCampaignsService },
        { provide: CatalogService, useValue: mockCatalogService },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
      ],
    });

    fixture = TestBed.createComponent(ParticipantAtelierPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('charge l\'atelier du PARTICIPANT CIBLÉ (pas le sien), le catalogue et les noms de campagne/participant', () => {
    createFixture('3', '2');

    expect(mockCampaignsService.getParticipantWorkshop).toHaveBeenCalledWith(3, 2);
    expect(mockCampaignsService.getOne).toHaveBeenCalledWith(3);
    expect(mockCampaignsService.getParticipants).toHaveBeenCalledWith(3);
    expect(mockCatalogService.getSponsorByName).toHaveBeenCalledWith('Rutherford');
    expect(component.loading()).toBe(false);
    expect(component.wallet()).toBe(10);
    expect(component.participantName()).toBe('Alice Martin');
  });

  it('sélectionne automatiquement le premier véhicule au chargement', () => {
    createFixture('3', '2');

    expect(component.selectedVehicleId()).toBe(5);
    expect(component.selectedVehicle()?.id).toBe(5);
  });

  it('change la sélection au clic sur un autre véhicule, sans navigation', () => {
    createFixture('3', '2');

    component.onSelectVehicle(6);

    expect(component.selectedVehicleId()).toBe(6);
    expect(component.selectedVehicle()?.customName).toBe('La Teigne');
  });

  it('calcule la synthèse de budget (total = cagnotte + coût de TOUS les véhicules)', () => {
    createFixture('3', '2');

    // wallet 10 + (16 + 16) = 42 ; consommé = 32.
    expect(component.totalVehiclesCost()).toBe(32);
    expect(component.budgetEquipeTotal()).toBe(42);
    expect(component.budgetRestant()).toBe(10);
    expect(component.budgetDepasse()).toBe(false);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-team-budget')).toBeTruthy();
  });

  it('titre "Atelier de [Équipe] ([Joueur])" et fil d\'ariane assorti', () => {
    createFixture('3', '2');

    expect(component.teamName()).toBe('Scrap Kings');
    expect(component.headerTitle()).toBe('Atelier de Scrap Kings (Alice Martin)');
    expect(component.breadcrumbs()).toEqual([
      { label: 'Mes Campagnes', route: ['/campaigns'] },
      { label: 'Les Terres Brûlées', route: ['/campaigns', '3'] },
      { label: 'Atelier de Scrap Kings (Alice Martin)' },
    ]);
  });

  it('répartit le détail du véhicule sélectionné sur 2 sous-colonnes (armes+améliorations / avantages+séquelles)', () => {
    createFixture('3', '2');

    const el = fixture.nativeElement as HTMLElement;
    const columns = el.querySelectorAll('.pap-equipment-col');
    expect(columns.length).toBe(2);
    expect(columns[0].querySelectorAll('app-mounted-equipment').length).toBe(1);
    expect(columns[1].querySelectorAll('app-mounted-equipment').length).toBe(1);
  });

  it("affiche une erreur si le chargement de l'atelier échoue", () => {
    mockCampaignsService.getParticipantWorkshop.mockReturnValue(throwError(() => new Error('Network error')));

    createFixture('3', '2');

    expect(component.error()).toContain("Impossible de charger l'atelier");
    expect(component.loading()).toBe(false);
  });
});
