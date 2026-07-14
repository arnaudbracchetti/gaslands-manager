/**
 * Tests unitaires pour SequellaManager.
 *
 * Composant "smart" atelier-only : mocks `CampaignsService`/`CatalogService` directs
 * (pas d'`EquipmentDataSource`, cf. en-tête de `sequella-manager.ts` — ce composant
 * n'a qu'un seul backend possible, contrairement à `EquipmentManager`). Couvre :
 *  - chargement des séquelles disponibles + affichage des Chocs
 *  - achat direct (séquelle neutre) vs achat via picker (Dur à Cuire)
 *  - annulation même-session (toujours possible) vs revente (verrouillée par défaut,
 *    débloquée par la présence de "Légende Vivante")
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { of, throwError } from 'rxjs';
import { SequellaManager } from './sequella-manager';
import { CampaignsService } from '../../campaigns.service';
import { CatalogService } from '../../../catalog/catalog.service';
import type { Avantage } from '../../../catalog/catalog.model';
import type { AvailableSequellaDto, WorkshopVehicleDto } from '../../workshop.model';

const durACuireAdvantages: Avantage[] = [
  { nom: 'Baril de Poudre', nom_interne: 'baril_de_poudre', categorie: 'Dur à Cuire', prix: 1, description: '', regles: '' },
  { nom: 'Fou Furieux', nom_interne: 'fou_furieux', categorie: 'Dur à Cuire', prix: 3, description: '', regles: '' },
];

const otherCategoryAdvantage: Avantage = {
  nom: 'Tireur d\'Élite', nom_interne: 'tireur_elite', categorie: 'Militaire', prix: 2, description: '', regles: '',
};

const availableSequelles: AvailableSequellaDto[] = [
  { nom: 'Suicidaire', nomInterne: 'suicidaire', chocsCost: 1, description: 'Texte.', disponible: true },
  {
    nom: 'Légende Vivante', nomInterne: 'legende_vivante', chocsCost: 11, description: 'Texte.',
    disponible: false, raison: 'Chocs insuffisants (solde actuel : 5, coût : 11)',
  },
  { nom: 'Dur à Cuire', nomInterne: 'dur_a_cuire', chocsCost: 6, description: 'Texte.', disponible: true },
];

function makeVehicle(overrides: Partial<WorkshopVehicleDto> = {}): WorkshopVehicleDto {
  return {
    id: 5, nomInterne: 'camion', price: 16, isLost: false, chocs: 5, sequellas: [],
    weapons: [], improvements: [], advantages: [], resaleRefund: 8, purchasedThisSession: false,
    emplacementsTotal: 4,
    ...overrides,
  };
}

describe('SequellaManager', () => {
  let component: SequellaManager;
  let fixture: ComponentFixture<SequellaManager>;
  let mockCampaignsService: {
    getWorkshopAvailableSequelles: ReturnType<typeof vi.fn>;
    changeEquipment: ReturnType<typeof vi.fn>;
  };
  let mockCatalogService: { getAllAvantages: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockCampaignsService = {
      getWorkshopAvailableSequelles: vi.fn().mockReturnValue(of(availableSequelles)),
      changeEquipment: vi.fn().mockReturnValue(of(undefined)),
    };
    mockCatalogService = {
      getAllAvantages: vi.fn().mockReturnValue(of([...durACuireAdvantages, otherCategoryAdvantage])),
    };

    await TestBed.configureTestingModule({
      imports: [SequellaManager],
      providers: [
        { provide: CampaignsService, useValue: mockCampaignsService },
        { provide: CatalogService, useValue: mockCatalogService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SequellaManager);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('campaignId', 1);
    fixture.componentRef.setInput('vehicle', makeVehicle());
    fixture.detectChanges();
  });

  // ── Chargement / affichage ───────────────────────────────────────────────────

  it('charge les séquelles disponibles pour ce véhicule et affiche le solde de Chocs', () => {
    expect(mockCampaignsService.getWorkshopAvailableSequelles).toHaveBeenCalledWith(1, 5);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.sm__chocs')?.textContent).toContain('5');
  });

  it('affiche chaque séquelle disponible avec son coût en Chocs', () => {
    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.sm__group')[0].querySelectorAll('.sm__item');

    expect(items).toHaveLength(3);
    expect(items[0].textContent).toContain('Suicidaire');
    expect(items[0].textContent).toContain('1');
  });

  it('ne filtre que le catalogue "Dur à Cuire" pour le picker (charge une seule fois, indépendamment du véhicule)', () => {
    expect(mockCatalogService.getAllAvantages).toHaveBeenCalledTimes(1);
    expect(component.durACuireAdvantages()).toEqual(durACuireAdvantages);
  });

  it('affiche la raison et masque "Acquérir" pour une séquelle indisponible (Chocs insuffisants)', () => {
    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.sm__group')[0].querySelectorAll('.sm__item');
    const legendeVivante = Array.from(items).find((i) => i.textContent?.includes('Légende Vivante')) as HTMLElement;

    expect(legendeVivante.textContent).toContain('Chocs insuffisants');
    expect(legendeVivante.querySelector('.sm__acquire')).toBeNull();
  });

  // ── Achat direct (séquelle neutre) ───────────────────────────────────────────

  it('achète directement une séquelle neutre (pas de picker)', () => {
    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.sm__group')[0].querySelectorAll('.sm__item');
    const suicidaire = Array.from(items).find((i) => i.textContent?.includes('Suicidaire')) as HTMLElement;

    (suicidaire.querySelector('.sm__acquire') as HTMLButtonElement).click();

    expect(mockCampaignsService.changeEquipment).toHaveBeenCalledWith(1, {
      operation: 'BUY',
      entityType: 'SEQUELLE',
      nomInterne: 'suicidaire',
      targetVehicleId: 5,
      targetEntityId: null,
      orientation: null,
      freeAdvantageNomInterne: null,
    });
    expect(component.pendingDurACuireNomInterne()).toBeNull();
  });

  it('émet changed après un achat réussi', () => {
    const emitted: void[] = [];
    outputToObservable(component.changed).subscribe(() => emitted.push(undefined));

    component.onAcquireClicked(availableSequelles[0]);

    expect(emitted).toHaveLength(1);
  });

  it('affiche une erreur si l\'achat échoue, sans émettre changed', () => {
    mockCampaignsService.changeEquipment.mockReturnValue(
      throwError(() => ({ error: { message: 'Chocs insuffisants' } })),
    );
    const emitted: void[] = [];
    outputToObservable(component.changed).subscribe(() => emitted.push(undefined));

    component.onAcquireClicked(availableSequelles[0]);

    expect(component.error()).toBe('Chocs insuffisants');
    expect(emitted).toHaveLength(0);
  });

  // ── Achat via picker (Dur à Cuire) ────────────────────────────────────────────

  it('ouvre le picker d\'avantage gratuit au clic sur "Acquérir" pour Dur à Cuire', () => {
    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('.sm__group')[0].querySelectorAll('.sm__item');
    const durACuire = Array.from(items).find((i) => i.textContent?.includes('Dur à Cuire')) as HTMLElement;

    (durACuire.querySelector('.sm__acquire') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.pendingDurACuireNomInterne()).toBe('dur_a_cuire');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-sequella-advantage-picker')).not.toBeNull();
    expect(mockCampaignsService.changeEquipment).not.toHaveBeenCalled();
  });

  it('achète Dur à Cuire avec freeAdvantageNomInterne une fois le picker confirmé', () => {
    component.onAcquireClicked(availableSequelles[2]); // dur_a_cuire
    component.onAdvantagePicked('fou_furieux');

    expect(mockCampaignsService.changeEquipment).toHaveBeenCalledWith(1, {
      operation: 'BUY',
      entityType: 'SEQUELLE',
      nomInterne: 'dur_a_cuire',
      targetVehicleId: 5,
      targetEntityId: null,
      orientation: null,
      freeAdvantageNomInterne: 'fou_furieux',
    });
    expect(component.pendingDurACuireNomInterne()).toBeNull();
  });

  it('referme le picker sans achat si annulé', () => {
    component.onAcquireClicked(availableSequelles[2]);
    component.onAdvantagePickerCancelled();

    expect(component.pendingDurACuireNomInterne()).toBeNull();
    expect(mockCampaignsService.changeEquipment).not.toHaveBeenCalled();
  });

  // ── Retrait — annulation même-session (toujours possible) ────────────────────

  it('propose "Retirer" pour une séquelle achetée cette session, même sans Légende Vivante', () => {
    fixture.componentRef.setInput('vehicle', makeVehicle({
      sequellas: [{ id: -1, nomInterne: 'suicidaire', nom: 'Suicidaire', chocsCost: 1, origine: 'ATELIER', isSold: false, purchasedThisSession: true }],
    }));
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const owned = el.querySelectorAll('.sm__group')[1].querySelectorAll('.sm__item');

    expect(owned[0].querySelector('.sm__remove')).not.toBeNull();
    expect(owned[0].querySelector('.sm__locked')).toBeNull();
  });

  it('annule l\'achat (même session) avec le message dédié', () => {
    fixture.componentRef.setInput('vehicle', makeVehicle({
      sequellas: [{ id: -1, nomInterne: 'suicidaire', nom: 'Suicidaire', chocsCost: 1, origine: 'ATELIER', isSold: false, purchasedThisSession: true }],
    }));
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const owned = el.querySelectorAll('.sm__group')[1].querySelectorAll('.sm__item');
    (owned[0].querySelector('.sm__remove') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.pendingRemove()?.nomInterne).toBe('suicidaire');
    expect(component.removalMessage(component.pendingRemove()!)).toBe('Annuler l\'achat de "Suicidaire" ?');

    (el.querySelector('.cm-modal__confirm') as HTMLButtonElement).click();

    expect(mockCampaignsService.changeEquipment).toHaveBeenCalledWith(1, {
      operation: 'SELL',
      entityType: 'SEQUELLE',
      nomInterne: '',
      targetVehicleId: 5,
      targetEntityId: -1,
      orientation: null,
    });
  });

  // ── Retrait — revente cross-session (verrouillée par défaut) ─────────────────

  it('masque "Retirer" (affiche 🔒) pour une séquelle pré-existante sans Légende Vivante active', () => {
    fixture.componentRef.setInput('vehicle', makeVehicle({
      sequellas: [{ id: 10, nomInterne: 'suicidaire', nom: 'Suicidaire', chocsCost: 1, origine: 'ATELIER', isSold: false, purchasedThisSession: false }],
    }));
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const owned = el.querySelectorAll('.sm__group')[1].querySelectorAll('.sm__item');

    expect(owned[0].querySelector('.sm__remove')).toBeNull();
    expect(owned[0].querySelector('.sm__locked')).not.toBeNull();
  });

  it('débloque "Retirer" pour une séquelle pré-existante quand Légende Vivante est active sur le véhicule', () => {
    fixture.componentRef.setInput('vehicle', makeVehicle({
      sequellas: [
        { id: 10, nomInterne: 'suicidaire', nom: 'Suicidaire', chocsCost: 1, origine: 'ATELIER', isSold: false, purchasedThisSession: false },
        { id: 11, nomInterne: 'legende_vivante', nom: 'Légende Vivante', chocsCost: 11, origine: 'ATELIER', isSold: false, purchasedThisSession: false },
      ],
    }));
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const owned = el.querySelectorAll('.sm__group')[1].querySelectorAll('.sm__item');
    const suicidaire = Array.from(owned).find((i) => i.textContent?.includes('Suicidaire')) as HTMLElement;

    expect(suicidaire.querySelector('.sm__remove')).not.toBeNull();
    expect(component.resaleUnlocked()).toBe(true);
  });

  it('revend une séquelle pré-existante avec le message de perte totale', () => {
    fixture.componentRef.setInput('vehicle', makeVehicle({
      sequellas: [
        { id: 10, nomInterne: 'suicidaire', nom: 'Suicidaire', chocsCost: 1, origine: 'ATELIER', isSold: false, purchasedThisSession: false },
        { id: 11, nomInterne: 'legende_vivante', nom: 'Légende Vivante', chocsCost: 11, origine: 'ATELIER', isSold: false, purchasedThisSession: false },
      ],
    }));
    fixture.detectChanges();

    const sequella = component.vehicle().sequellas[0];
    expect(component.removalMessage(sequella)).toBe(
      'Revendre "Suicidaire" ? Aucun remboursement (perte totale de Chocs).',
    );
  });

  it('ne montre plus la séquelle vendue comme retirable (watermark "Vendue")', () => {
    fixture.componentRef.setInput('vehicle', makeVehicle({
      sequellas: [{ id: 10, nomInterne: 'suicidaire', nom: 'Suicidaire', chocsCost: 1, origine: 'ATELIER', isSold: true, purchasedThisSession: false }],
    }));
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const owned = el.querySelectorAll('.sm__group')[1].querySelectorAll('.sm__item');

    expect(owned[0].textContent).toContain('Vendue');
    expect(owned[0].querySelector('.sm__remove')).toBeNull();
    expect(owned[0].querySelector('.sm__locked')).toBeNull();
  });
});
