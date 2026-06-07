/**
 * Tests unitaires pour WeaponService — orchestration métier du module Weapon.
 *
 * Mirroir du plan de tests de `vehicle.service.spec.ts` (cf. son en-tête) — on
 * mock TOUTES les dépendances (`Repository<Weapon>`, `VehicleService`,
 * `CatalogService`) : ce qu'on teste est l'ORCHESTRATION (sécurité, "envelopper
 * PUIS valider PUIS persister", règles de cohérence sponsor/orientation/
 * emplacements), jamais une vraie requête SQL ni le détail du catalogue.
 *
 * Différence structurelle avec son modèle : pas de `VehicleBuild`/`fakeBuild` —
 * `WeaponService` ne construit AUCUNE chaîne (cf. en-tête de `weapon.service.ts`,
 * "les armes ne modifient jamais les stats du véhicule"). `checkCandidate` se lit
 * directement sur le catalogue et les lignes persistées : les fixtures suffisent.
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Arme, Sponsor, Vehicule } from '../catalog/catalog.interfaces';
import { CatalogService } from '../catalog/catalog.service';
import { VehicleService } from '../vehicle/vehicle.service';
import { Vehicle } from '../vehicle/vehicle.entity';
import { fail, ok } from '../vehicle/vehicle-build';
import { Weapon } from './weapon.entity';
import { WeaponService } from './weapon.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const catalogVehicule: Vehicule = {
  nom: 'Camion',
  nom_interne: 'camion',
  poids: 'Moyen',
  carrosserie: 14,
  manoeuvrabilite: 1,
  vitesse_max: 6,
  equipage: 2,
  emplacements: 5,
  prix: 16,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

// Arme "montée sur chassis" — orientation OBLIGATOIRE (cf. `weapon.entity.ts`).
const armeMitrailleuse: Arme = {
  nom: 'Mitrailleuse',
  nom_interne: 'mitrailleuse',
  type: 'base',
  prix: 4,
  emplacement: 1,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

// Arme "avancée" — même contrainte d'orientation que `armeMitrailleuse`, prix/
// emplacement différents (utile aux tests du pool d'emplacements partagé).
const armeBFG: Arme = {
  nom: 'BFG',
  nom_interne: 'bfg',
  type: 'avancée',
  prix: 12,
  emplacement: 2,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

// Arme d'ÉQUIPAGE — orientation INTERDITE (portée par un équipier, 360° automatique,
// cf. `weapon.entity.ts`, note d'en-tête sur la nuance propre aux armes).
const armeGrenades: Arme = {
  nom: 'Grenades',
  nom_interne: 'grenades',
  type: 'équipage',
  prix: 2,
  emplacement: 0,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

// Arme volontairement absente de `sponsorRutherford.armes` — pour les tests
// "hors catalogue du sponsor" (mais bien présente dans le catalogue global).
const armeHorsSponsor: Arme = {
  nom: 'Canon à Arc Électrique',
  nom_interne: 'canon_arc_electrique',
  type: 'avancée',
  prix: 14,
  emplacement: 2,
  description: '',
  regles: '',
  sponsors_autorises: ['Mishkin'],
};

// Sponsor minimal — seul `armes` est consulté par `WeaponService`
// (le reste du catalogue qu'il porterait est hors périmètre ici).
const sponsorRutherford: Sponsor = {
  nom: 'Rutherford',
  description: '',
  classes_avantage: [],
  avantages_sponsorises: '',
  vehicules: [],
  armes: [armeMitrailleuse, armeBFG, armeGrenades],
  ameliorations: [],
};

// Équipe minimale portée par la relation `team` — seul `sponsor` nous intéresse.
const mockTeam = { id: 3, sponsor: 'Rutherford' } as unknown as Vehicle['team'];

const mockVehicle: Vehicle = {
  id: 7,
  nomInterne: 'camion',
  team: mockTeam,
  teamId: 3,
  improvements: [],
  weapons: [],
  createdAt: new Date('2025-01-01'),
};

describe('WeaponService', () => {
  let service: WeaponService;

  // Un mock par dépendance injectée — chacun isolé, remis à zéro entre les tests.
  const mockWeaponRepo = {
    create: vi.fn(),
    save: vi.fn(),
    findOne: vi.fn(),
    remove: vi.fn(),
  };
  // `WeaponService` ne touche JAMAIS aux Repository de `Vehicle`/`VehicleImprovement` :
  // il délègue systématiquement à `VehicleService` (cf. en-tête de `weapon.service.ts`,
  // "pourquoi un service à part" — `findOneForUser` + helpers d'emplacements partagés).
  const mockVehicleService = {
    findOneForUser: vi.fn(),
    improvementSlotsOf: vi.fn(),
    weaponSlotsOf: vi.fn(),
  };
  const mockCatalogService = {
    getArmeByNomInterne: vi.fn(),
    getVehiculeByNomInterne: vi.fn(),
    getSponsor: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeaponService,
        { provide: getRepositoryToken(Weapon), useValue: mockWeaponRepo },
        { provide: VehicleService, useValue: mockVehicleService },
        { provide: CatalogService, useValue: mockCatalogService },
      ],
    }).compile();

    service = module.get<WeaponService>(WeaponService);
    vi.clearAllMocks();

    // Configuration par défaut — un véhicule "nu" (aucune amélioration ni arme
    // installée), dans un sponsor qui autorise les trois fixtures `arme*`.
    // Chaque test ne redéfinit QUE ce qui le distingue de ce socle commun.
    mockVehicleService.findOneForUser.mockResolvedValue(mockVehicle);
    mockVehicleService.improvementSlotsOf.mockReturnValue(0);
    mockVehicleService.weaponSlotsOf.mockReturnValue(0);
    mockCatalogService.getSponsor.mockReturnValue(sponsorRutherford);
    mockCatalogService.getVehiculeByNomInterne.mockReturnValue(catalogVehicule);
    mockCatalogService.getArmeByNomInterne.mockImplementation((nomInterne: string) =>
      [armeMitrailleuse, armeBFG, armeGrenades, armeHorsSponsor].find((a) => a.nom_interne === nomInterne),
    );
  });

  // ── canAddWeapon() ──────────────────────────────────────────────────────────

  describe('canAddWeapon()', () => {
    it('refuse — arme inconnue du catalogue', async () => {
      mockCatalogService.getArmeByNomInterne.mockReturnValue(undefined);

      const result = await service.canAddWeapon(7, 42, 'arme_fantome', 'avant');

      expect(result).toEqual(fail('Arme inconnue du catalogue : "arme_fantome"'));
      // Échec précoce — aucune des règles suivantes (sponsor, orientation,
      // emplacements) n'a de raison d'être évaluée sur une arme qui n'existe pas.
      expect(mockCatalogService.getSponsor).not.toHaveBeenCalled();
    });

    it('refuse — arme hors du catalogue du sponsor', async () => {
      const result = await service.canAddWeapon(7, 42, 'canon_arc_electrique', 'avant');

      expect(result).toEqual(
        fail('L\'arme "Canon à Arc Électrique" n\'est pas autorisée pour le sponsor "Rutherford"'),
      );
    });

    it('refuse — orientation manquante pour une arme qui en a besoin (hors équipage)', async () => {
      const result = await service.canAddWeapon(7, 42, 'mitrailleuse');

      expect(result).toEqual(fail('Une orientation est requise pour monter "Mitrailleuse" sur un arc de tir'));
    });

    it('refuse — orientation fournie pour une arme d\'équipage (interdite, 360° automatique)', async () => {
      const result = await service.canAddWeapon(7, 42, 'grenades', 'avant');

      expect(result).toEqual(
        fail('"Grenades" est une arme d\'équipage : elle ne se monte pas sur un arc de tir précis'),
      );
    });

    it('refuse — POOL D\'EMPLACEMENTS PARTAGÉ — si améliorations + armes déjà montées + cette arme dépassent la capacité', async () => {
      // 3 (améliorations) + 2 (armes déjà montées) + 1 (mitrailleuse, candidate) = 6 > 5
      mockVehicleService.improvementSlotsOf.mockReturnValue(3);
      mockVehicleService.weaponSlotsOf.mockReturnValue(2);

      const result = await service.canAddWeapon(7, 42, 'mitrailleuse', 'avant');

      expect(result).toEqual(fail('Emplacements insuffisants : 6/5 requis avec "Mitrailleuse"'));
    });

    it('accepte — sponsor autorise, orientation cohérente, emplacements suffisants (arme orientable)', async () => {
      mockVehicleService.improvementSlotsOf.mockReturnValue(1);
      mockVehicleService.weaponSlotsOf.mockReturnValue(1);
      // 1 + 1 + 2 (BFG) = 4 ≤ 5

      const result = await service.canAddWeapon(7, 42, 'bfg', 'gauche');

      expect(result).toEqual(ok());
    });

    it('accepte — arme d\'équipage SANS orientation (cas nominal pour ce type)', async () => {
      const result = await service.canAddWeapon(7, 42, 'grenades');

      expect(result).toEqual(ok());
    });

    it('lève une Error si le sponsor de l\'équipe est inconnu du catalogue (incohérence de données)', async () => {
      mockCatalogService.getSponsor.mockReturnValue(undefined);

      await expect(service.canAddWeapon(7, 42, 'mitrailleuse', 'avant')).rejects.toThrow(
        'Sponsor catalogue inconnu : "Rutherford" (équipe #3)',
      );
    });
  });

  // ── getAvailableWeapons() ───────────────────────────────────────────────────

  describe('getAvailableWeapons()', () => {
    it('retourne une ligne par arme du sponsor, avec son verdict de disponibilité', async () => {
      const result = await service.getAvailableWeapons(7, 42);

      expect(result).toEqual([
        {
          nom: 'Mitrailleuse',
          nomInterne: 'mitrailleuse',
          prix: 4,
          emplacement: 1,
          type: 'base',
          // Sans orientation fournie ⇒ "il manque une information" (cf. note de
          // la méthode — même nuance que `getAvailableImprovements`/Bélier).
          disponible: false,
          raison: 'Une orientation est requise pour monter "Mitrailleuse" sur un arc de tir',
        },
        {
          nom: 'BFG',
          nomInterne: 'bfg',
          prix: 12,
          emplacement: 2,
          type: 'avancée',
          disponible: false,
          raison: 'Une orientation est requise pour monter "BFG" sur un arc de tir',
        },
        {
          nom: 'Grenades',
          nomInterne: 'grenades',
          prix: 2,
          emplacement: 0,
          type: 'équipage',
          // Pas d'orientation requise pour une arme d'équipage ⇒ disponible d'emblée.
          disponible: true,
          raison: undefined,
        },
      ]);
    });

    it('lève une Error si le sponsor de l\'équipe est inconnu du catalogue', async () => {
      mockCatalogService.getSponsor.mockReturnValue(undefined);

      await expect(service.getAvailableWeapons(7, 42)).rejects.toThrow(
        'Sponsor catalogue inconnu : "Rutherford" (équipe #3)',
      );
    });
  });

  // ── addWeapon() ─────────────────────────────────────────────────────────────

  describe('addWeapon()', () => {
    it('persiste l\'arme et retourne le véhicule rechargé si la vérification est positive', async () => {
      const createdRow = { vehicleId: 7, nomInterne: 'mitrailleuse', orientation: 'avant' };
      mockWeaponRepo.create.mockReturnValue(createdRow);
      mockWeaponRepo.save.mockResolvedValue({ id: 1, ...createdRow });
      const reloadedVehicle = { ...mockVehicle, weapons: [{ id: 1, ...createdRow }] };
      // Premier appel (canAddWeapon → findOneForUser) puis second (rechargement final).
      mockVehicleService.findOneForUser.mockResolvedValueOnce(mockVehicle).mockResolvedValueOnce(reloadedVehicle);

      const result = await service.addWeapon(7, 42, 'mitrailleuse', 'avant');

      expect(mockWeaponRepo.create).toHaveBeenCalledWith({
        vehicleId: 7,
        nomInterne: 'mitrailleuse',
        orientation: 'avant',
      });
      expect(mockWeaponRepo.save).toHaveBeenCalledWith(createdRow);
      expect(result).toBe(reloadedVehicle);
    });

    it('convertit `orientation` absente en `null` pour la persistance (convention TypeORM nullable)', async () => {
      mockWeaponRepo.create.mockReturnValue({});
      mockWeaponRepo.save.mockResolvedValue({});

      await service.addWeapon(7, 42, 'grenades');

      expect(mockWeaponRepo.create).toHaveBeenCalledWith({
        vehicleId: 7,
        nomInterne: 'grenades',
        orientation: null,
      });
    });

    it('lève BadRequestException SANS RIEN PERSISTER si la vérification échoue', async () => {
      // Aucune orientation fournie pour une arme qui en a besoin ⇒ refus.
      await expect(service.addWeapon(7, 42, 'mitrailleuse')).rejects.toThrow(BadRequestException);
      await expect(service.addWeapon(7, 42, 'mitrailleuse')).rejects.toThrow(
        'Une orientation est requise pour monter "Mitrailleuse" sur un arc de tir',
      );

      expect(mockWeaponRepo.create).not.toHaveBeenCalled();
      expect(mockWeaponRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── removeWeapon() ──────────────────────────────────────────────────────────

  describe('removeWeapon()', () => {
    const installedWeapon: Weapon = {
      id: 9,
      nomInterne: 'mitrailleuse',
      orientation: 'avant',
      vehicle: mockVehicle,
      vehicleId: 7,
      createdAt: new Date('2025-01-01'),
    };

    it('retire l\'arme si elle appartient (via Vehicle → Team) à l\'utilisateur', async () => {
      mockWeaponRepo.findOne.mockResolvedValue(installedWeapon);
      mockWeaponRepo.remove.mockResolvedValue(undefined);

      await service.removeWeapon(9, 42);

      // Sécurité : la chaîne `Weapon → Vehicle → Team → User` — un maillon de plus
      // que `VehicleService.findOneForUser` (cf. son en-tête, `Weapon` ne porte
      // ni `userId` ni `teamId` directement).
      expect(mockWeaponRepo.findOne).toHaveBeenCalledWith({
        where: { id: 9, vehicle: { team: { userId: 42 } } },
      });
      expect(mockWeaponRepo.remove).toHaveBeenCalledWith(installedWeapon);
    });

    it('lève NotFoundException si l\'arme est introuvable OU appartient à un autre utilisateur', async () => {
      // `findOne` renvoie `null` dans les DEUX cas (arme inexistante / autre
      // propriétaire) — indiscernables pour l'appelant, par construction
      // (cf. en-tête de `VehicleService` : ne jamais révéler l'existence d'une
      // ressource qu'on ne possède pas).
      mockWeaponRepo.findOne.mockResolvedValue(null);

      await expect(service.removeWeapon(9, 99)).rejects.toThrow(NotFoundException);
      expect(mockWeaponRepo.remove).not.toHaveBeenCalled();
    });
  });
});
