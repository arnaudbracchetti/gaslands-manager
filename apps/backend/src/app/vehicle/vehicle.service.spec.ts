/**
 * Tests unitaires pour VehicleService — orchestration métier du module Vehicle.
 *
 * On mock TOUTES les dépendances (Repository<Vehicle>, Repository<VehicleImprovement>,
 * CatalogService, VehicleBuildFactory, ImprovementDecoratorFactory). Ce qu'on teste ici
 * N'EST PAS une règle métier d'amélioration (→ improvement-decorators.spec.ts) ni le
 * mécanisme générique du Decorator (→ vehicle-build.spec.ts), mais l'ORCHESTRATION :
 * comment le service enchaîne ces pièces, et applique son contrat — sécurité par
 * utilisateur, "envelopper PUIS valider SANS persister", "persister seulement si ok".
 *
 * Les chaînes `VehicleBuild` manipulées par `getBuild`/`canAddImprovement` sont donc de
 * simples doubles de test (`fakeBuild`) : le service ne connaît QUE le contrat
 * `VehicleBuild`, jamais une classe concrète — le tester n'exige aucune vraie chaîne.
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Amelioration, Arme, Sponsor, Vehicule } from '../catalog/catalog.interfaces';
import { CatalogService } from '../catalog/catalog.service';
import { TeamService } from '../team/team.service';
import { Weapon } from '../weapon/weapon.entity';
import { Vehicle, VehicleImprovement } from './vehicle.entity';
import { VehicleService } from './vehicle.service';
import { VehicleBuildFactory } from './vehicle-build.factory';
import { ImprovementDecoratorFactory } from './improvement-decorator.factory';
import { fail, ok, type VehicleBuild, type VehicleStats } from './vehicle-build';

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

const ameliorationChenilles: Amelioration = {
  nom: 'Chenilles',
  nom_interne: 'chenilles',
  comportement: 'chenilles',
  prix: 4,
  emplacement: 1,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

const ameliorationBlindage: Amelioration = {
  nom: 'Blindage',
  nom_interne: 'blindage',
  comportement: 'blindage',
  prix: 4,
  emplacement: 1,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

// Fixture d'arme — utilisée par les tests des helpers d'emplacements partagés
// (`improvementSlotsOf`/`weaponSlotsOf`) et l'intégration dans `checkCandidate`
// (cf. plan, "Décision de conception tranchée — calcul des emplacements partagés").
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

const ameliorationTourelle: Amelioration = {
  nom: 'Tourelle',
  nom_interne: 'tourelle',
  prix: 'x3',
  emplacement: 0,
  description: '',
  regles: '',
  sponsors_autorises: ['Rutherford'],
};

// Sponsor minimal — seul `ameliorations` est consulté par `getAvailableImprovements`
// (le reste du catalogue qu'il porterait — véhicules, armes — est hors périmètre ici).
const sponsorRutherford: Sponsor = {
  nom: 'Rutherford',
  description: '',
  classes_avantage: [],
  avantages_sponsorises: '',
  vehicules: [],
  armes: [],
  ameliorations: [ameliorationChenilles, ameliorationBlindage, ameliorationTourelle],
};

// Équipe minimale portée par la relation `team` — `findOneForUser` la charge
// désormais systématiquement (cf. commentaire de la méthode : le `where` la
// joint de toute façon, et `getAvailableImprovements` a besoin de `sponsor`).
// Seul `sponsor` nous intéresse ici ; le reste est sans incidence sur ces tests.
const mockTeam = { id: 3, sponsor: 'Rutherford' } as unknown as Vehicle['team'];

const mockVehicle: Vehicle = {
  id: 7,
  nomInterne: 'camion',
  team: mockTeam,
  teamId: 3,
  improvements: [],
  // `weapons: []` — désormais chargée systématiquement par `findOneForUser`
  // (cf. son commentaire) : `checkCandidate` en a besoin pour `weaponSlotsOf`
  // (pool d'emplacements partagé, cf. plan). Vide ici : ces tests d'orchestration
  // ne portent pas sur les armes — `weaponSlotsOf` retournera simplement 0.
  weapons: [],
  createdAt: new Date('2025-01-01'),
};

// Fixtures d'instances persistées — une amélioration et une arme installées,
// utilisées par les tests de `improvementSlotsOf`/`weaponSlotsOf` et de
// l'intégration du pool d'emplacements partagé dans `checkCandidate`.
const installedChenilles: VehicleImprovement = {
  id: 1,
  nomInterne: 'chenilles',
  orientation: null,
  vehicle: mockVehicle,
  vehicleId: 7,
  createdAt: new Date('2025-01-01'),
};

const installedMitrailleuse: Weapon = {
  id: 1,
  nomInterne: 'mitrailleuse',
  orientation: 'avant',
  vehicle: mockVehicle,
  vehicleId: 7,
  createdAt: new Date('2025-01-01'),
};

const statsParDefaut: VehicleStats = {
  nom_interne: 'camion',
  poids: 'Moyen',
  carrosserie: 14,
  manoeuvrabilite: 1,
  vitesse_max: 6,
  equipage: 2,
  emplacements: 5,
};

/**
 * Double de test minimal pour `VehicleBuild` — pas une vraie chaîne de décorateurs.
 * `getBuild`/`canAddImprovement` ne manipulent que le CONTRAT (jamais une classe
 * concrète) : leur orchestration se teste donc avec n'importe quel objet qui le
 * respecte. `overrides` permet de ne personnaliser que ce que le test observe
 * (typiquement `validate`), sans répéter les sept membres à chaque fois.
 */
function fakeBuild(overrides: Partial<VehicleBuild> = {}): VehicleBuild {
  return {
    stats: statsParDefaut,
    baseStats: statsParDefaut,
    describe: () => [],
    countByType: () => 0,
    hasOrientationFor: () => false,
    totalEmplacements: () => 0,
    validate: () => ok(),
    ...overrides,
  };
}

describe('VehicleService', () => {
  let service: VehicleService;

  // Un mock par dépendance injectée — chacun isolé, remis à zéro entre les tests.
  const mockVehicleRepo = {
    findOne: vi.fn(),
    // Nécessaires à `create()` (cf. son describe ci-dessous) — `create` construit
    // l'entité en mémoire, `save` la persiste ; le résultat brut de `save` n'est
    // PAS celui retourné par le service (cf. contrat "persister PUIS recharger").
    create: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
  };
  const mockImprovementRepo = {
    create: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
  };
  const mockCatalogService = {
    getVehiculeByNomInterne: vi.fn(),
    getAmeliorationByNomInterne: vi.fn(),
    // Nécessaire à `weaponSlotsOf` (résout `Weapon.nomInterne → Arme.emplacement`,
    // miroir exact de `getAmeliorationByNomInterne` côté `improvementSlotsOf`).
    getArmeByNomInterne: vi.fn(),
    getSponsor: vi.fn(),
  };
  // Nécessaire depuis que VehicleService injecte TeamService (cf. findAllForTeam/create
  // — vérifier l'appartenance de l'équipe AVANT de lister/créer ses véhicules). Les
  // tests ci-dessous ne couvrent QUE les méthodes préexistantes : ce mock leur est
  // invisible, il sert uniquement à satisfaire le constructeur (cf. vehicle-team
  // .controller.spec.ts / futurs tests dédiés pour la couverture de ces deux méthodes).
  const mockTeamService = {
    findOneForUser: vi.fn(),
  };
  const mockBuildFactory = {
    create: vi.fn(),
  };
  const mockDecoratorFactory = {
    wrap: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VehicleService,
        { provide: getRepositoryToken(Vehicle), useValue: mockVehicleRepo },
        { provide: getRepositoryToken(VehicleImprovement), useValue: mockImprovementRepo },
        { provide: CatalogService, useValue: mockCatalogService },
        { provide: TeamService, useValue: mockTeamService },
        { provide: VehicleBuildFactory, useValue: mockBuildFactory },
        { provide: ImprovementDecoratorFactory, useValue: mockDecoratorFactory },
      ],
    }).compile();

    service = module.get<VehicleService>(VehicleService);
    vi.clearAllMocks();
  });

  // ── findOneForUser ──────────────────────────────────────────────────────────

  describe('findOneForUser()', () => {
    it('retourne le véhicule en filtrant par la chaîne Vehicle → Team → User', async () => {
      mockVehicleRepo.findOne.mockResolvedValue(mockVehicle);

      const result = await service.findOneForUser(7, 42);

      // `Vehicle` ne porte pas de `userId` direct (contrairement à `Team`) : il faut
      // remonter par sa relation `team` — TypeORM traduit la condition imbriquée en
      // jointure SQL (cf. commentaire de la méthode).
      expect(mockVehicleRepo.findOne).toHaveBeenCalledWith({
        where: { id: 7, team: { userId: 42 } },
        relations: { team: true, improvements: true, weapons: true },
      });
      expect(result).toEqual(mockVehicle);
    });

    it('lève NotFoundException si le véhicule est introuvable ou appartient à un autre utilisateur', async () => {
      // Les deux cas sont indiscernables pour l'appelant, par conception (cf. §sécurité) —
      // un seul scénario suffit donc à couvrir "introuvable" ET "appartenance refusée".
      mockVehicleRepo.findOne.mockResolvedValue(null);

      await expect(service.findOneForUser(999, 42)).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create() — création "nue", validée contre le catalogue du sponsor', () => {
    it('persiste le véhicule et retourne le véhicule RECHARGÉ (improvements/weapons en tableaux, jamais undefined)', async () => {
      // `save()` retourne un véhicule "nu" — sans relations chargées (TypeORM ne
      // matérialise pas de tableaux vides pour des OneToMany non chargées). Le
      // contrat du service ("persister PUIS recharger via findOneForUser", même
      // raisonnement qu'`addImprovement`/`addWeapon`) garantit que l'APPELANT ne
      // voit jamais cette entité brute, mais toujours la version rechargée.
      mockTeamService.findOneForUser.mockResolvedValue(mockTeam);
      mockCatalogService.getVehiculeByNomInterne.mockReturnValue(catalogVehicule);
      mockCatalogService.getSponsor.mockReturnValue({
        ...sponsorRutherford,
        vehicules: [catalogVehicule],
      });
      // `save()` mute et retourne LA MÊME entité que `create()` (TypeORM lui
      // assigne son `id` généré) — d'où la lecture de `vehicle.id` après l'attente,
      // dans le service. Le mock reflète cette continuité de référence.
      const vehiculeBrut = { id: 7, teamId: 3, nomInterne: 'camion' };
      mockVehicleRepo.create.mockReturnValue(vehiculeBrut);
      mockVehicleRepo.save.mockResolvedValue(vehiculeBrut);
      mockVehicleRepo.findOne.mockResolvedValue(mockVehicle);

      const result = await service.create(3, 42, 'camion');

      expect(mockVehicleRepo.create).toHaveBeenCalledWith({ teamId: 3, nomInterne: 'camion' });
      expect(mockVehicleRepo.save).toHaveBeenCalled();
      // RECHARGÉ : le résultat de `findOneForUser`, avec `improvements`/`weapons`
      // en tableaux — jamais l'entité brute renvoyée par `save`.
      expect(mockVehicleRepo.findOne).toHaveBeenCalledWith({
        where: { id: 7, team: { userId: 42 } },
        relations: { team: true, improvements: true, weapons: true },
      });
      expect(result).toEqual(mockVehicle);
      expect(result.improvements).toEqual([]);
      expect(result.weapons).toEqual([]);
    });

    it('lève BadRequestException si le nomInterne est inconnu du catalogue, et ne persiste rien', async () => {
      mockTeamService.findOneForUser.mockResolvedValue(mockTeam);
      mockCatalogService.getVehiculeByNomInterne.mockReturnValue(undefined);

      const promesse = service.create(3, 42, 'vehicule-fantome');

      await expect(promesse).rejects.toThrow(BadRequestException);
      await expect(promesse).rejects.toThrow(/vehicule-fantome/);
      expect(mockVehicleRepo.create).not.toHaveBeenCalled();
      expect(mockVehicleRepo.save).not.toHaveBeenCalled();
    });

    it('lève BadRequestException si le véhicule n\'est pas autorisé pour le sponsor de l\'équipe, et ne persiste rien', async () => {
      mockTeamService.findOneForUser.mockResolvedValue(mockTeam);
      mockCatalogService.getVehiculeByNomInterne.mockReturnValue(catalogVehicule);
      // Sponsor dont le catalogue NE CONTIENT PAS `catalogVehicule` — non autorisé.
      mockCatalogService.getSponsor.mockReturnValue({ ...sponsorRutherford, vehicules: [] });

      const promesse = service.create(3, 42, 'camion');

      await expect(promesse).rejects.toThrow(BadRequestException);
      await expect(promesse).rejects.toThrow(/n'est pas autorisé pour le sponsor/);
      expect(mockVehicleRepo.create).not.toHaveBeenCalled();
      expect(mockVehicleRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── getBuild ────────────────────────────────────────────────────────────────

  describe('getBuild()', () => {
    it('résout le véhicule catalogue par nomInterne, convertit les améliorations puis délègue à VehicleBuildFactory', () => {
      const vehicleAvecAmeliorations: Vehicle = {
        ...mockVehicle,
        improvements: [
          { id: 1, nomInterne: 'chenilles', orientation: null, vehicle: null as never, vehicleId: 7, createdAt: new Date() },
          { id: 2, nomInterne: 'belier', orientation: 'avant', vehicle: null as never, vehicleId: 7, createdAt: new Date() },
        ],
      };
      const built = fakeBuild();
      mockCatalogService.getVehiculeByNomInterne.mockReturnValue(catalogVehicule);
      mockBuildFactory.create.mockReturnValue(built);

      const result = service.getBuild(vehicleAvecAmeliorations);

      expect(mockCatalogService.getVehiculeByNomInterne).toHaveBeenCalledWith('camion');
      // `null` (convention SQL "non orientée") devient `undefined` (vocabulaire
      // `InstalledImprovement`) — chaque couche garde le sien (cf. commentaire de la méthode).
      expect(mockBuildFactory.create).toHaveBeenCalledWith(catalogVehicule, [
        { nom_interne: 'chenilles', orientation: undefined },
        { nom_interne: 'belier', orientation: 'avant' },
      ]);
      expect(result).toBe(built);
    });

    it('lève une Error — incohérence de DONNÉES, pas une erreur utilisateur — si le véhicule catalogue est introuvable', () => {
      mockCatalogService.getVehiculeByNomInterne.mockReturnValue(undefined);

      // Une simple `Error`, jamais une exception HTTP : le `nomInterne` vient de la
      // BASE (donc du catalogue à un instant T), pas d'une saisie utilisateur — si le
      // catalogue a changé depuis, c'est un problème d'intégrité, pas une faute du client.
      expect(() => service.getBuild(mockVehicle)).toThrow(/camion/);
      expect(mockBuildFactory.create).not.toHaveBeenCalled();
    });
  });

  // ── improvementSlotsOf / weaponSlotsOf ──────────────────────────────────────
  //
  // Ces deux helpers PUBLICS répondent à un besoin transversal : `Vehicule
  // .emplacements` est un pool PARTAGÉ entre améliorations et armes (cf. plan,
  // "Décision de conception tranchée — calcul des emplacements partagés"), or
  // `VehicleBuild.totalEmplacements()` ne connaît QUE les améliorations — par
  // conception, pour ne pas mélanger deux préoccupations dans le Décorateur.
  // Une simple somme sur les lignes PERSISTÉES, résolues via le catalogue —
  // rien d'autre : pas de chaîne, pas d'état, triviale à isoler et à tester.

  describe('improvementSlotsOf() / weaponSlotsOf() — emplacements consommés par le pool partagé', () => {
    it('additionne les emplacements des améliorations RÉELLEMENT posées, résolues via le catalogue', () => {
      const vehicule = { ...mockVehicle, improvements: [installedChenilles, installedChenilles] };
      mockCatalogService.getAmeliorationByNomInterne.mockReturnValue(ameliorationChenilles);

      expect(service.improvementSlotsOf(vehicule)).toBe(2 * ameliorationChenilles.emplacement);
      expect(mockCatalogService.getAmeliorationByNomInterne).toHaveBeenCalledWith('chenilles');
    });

    it('additionne les emplacements des armes RÉELLEMENT montées, résolues via le catalogue', () => {
      const vehicule = { ...mockVehicle, weapons: [installedMitrailleuse] };
      mockCatalogService.getArmeByNomInterne.mockReturnValue(armeMitrailleuse);

      expect(service.weaponSlotsOf(vehicule)).toBe(armeMitrailleuse.emplacement);
      expect(mockCatalogService.getArmeByNomInterne).toHaveBeenCalledWith('mitrailleuse');
    });

    it('retourne 0 pour un véhicule sans amélioration ni arme — sans consulter le catalogue', () => {
      expect(service.improvementSlotsOf(mockVehicle)).toBe(0);
      expect(service.weaponSlotsOf(mockVehicle)).toBe(0);
      expect(mockCatalogService.getAmeliorationByNomInterne).not.toHaveBeenCalled();
      expect(mockCatalogService.getArmeByNomInterne).not.toHaveBeenCalled();
    });

    it('lève une Error — incohérence de DONNÉES — si une amélioration/arme installée est absente du catalogue', () => {
      const avecAmelioration = { ...mockVehicle, improvements: [installedChenilles] };
      mockCatalogService.getAmeliorationByNomInterne.mockReturnValue(undefined);
      expect(() => service.improvementSlotsOf(avecAmelioration)).toThrow(/chenilles/);

      const avecArme = { ...mockVehicle, weapons: [installedMitrailleuse] };
      mockCatalogService.getArmeByNomInterne.mockReturnValue(undefined);
      expect(() => service.weaponSlotsOf(avecArme)).toThrow(/mitrailleuse/);
    });
  });

  // ── canAddImprovement ───────────────────────────────────────────────────────

  describe('canAddImprovement() — vérification à blanc, sans persistance', () => {
    beforeEach(() => {
      mockVehicleRepo.findOne.mockResolvedValue(mockVehicle);
      mockCatalogService.getVehiculeByNomInterne.mockReturnValue(catalogVehicule);
      mockBuildFactory.create.mockReturnValue(fakeBuild());
    });

    it('lève NotFoundException si le véhicule n\'appartient pas à l\'utilisateur — avant même de consulter le catalogue', async () => {
      mockVehicleRepo.findOne.mockResolvedValue(null);

      await expect(service.canAddImprovement(7, 99, 'chenilles')).rejects.toThrow(NotFoundException);
      // L'appartenance est vérifiée EN PREMIER (findOneForUser) : aucune autre étape
      // ne s'exécute après un refus — ni recherche catalogue, ni construction de chaîne.
      expect(mockCatalogService.getAmeliorationByNomInterne).not.toHaveBeenCalled();
    });

    it('retourne fail(...) si l\'amélioration est inconnue du catalogue — sans construire de chaîne candidate', async () => {
      mockCatalogService.getAmeliorationByNomInterne.mockReturnValue(undefined);

      const result = await service.canAddImprovement(7, 42, 'inconnue');

      // Exprimé comme un RuleResult (pas une exception) : addImprovement le traduira
      // ensuite en BadRequestException, sans distinguer "inconnue" de "règle violée"
      // (cf. commentaire de la méthode — uniformité du traitement de l'échec).
      expect(result).toEqual(fail('Amélioration inconnue du catalogue : "inconnue"'));
      expect(mockDecoratorFactory.wrap).not.toHaveBeenCalled();
    });

    it('enveloppe la chaîne actuelle avec le candidat PUIS délègue la validation — "ajouter, valider"', async () => {
      const currentBuild = fakeBuild();
      const candidateBuild = fakeBuild({ validate: () => ok() });
      mockBuildFactory.create.mockReturnValue(currentBuild);
      mockCatalogService.getAmeliorationByNomInterne.mockReturnValue(ameliorationChenilles);
      mockDecoratorFactory.wrap.mockReturnValue(candidateBuild);

      const result = await service.canAddImprovement(7, 42, 'chenilles', { orientation: 'avant' });

      // "Envelopper" : le candidat est posé PAR-DESSUS la chaîne RÉELLE — jamais l'inverse.
      // C'est précisément ce qui corrige le bug "première pose" (cf. plan) : le candidat
      // existe désormais dans ce qu'on examine, donc se valide systématiquement lui-même.
      expect(mockDecoratorFactory.wrap).toHaveBeenCalledWith(currentBuild, ameliorationChenilles, {
        nom_interne: 'chenilles',
        orientation: 'avant',
      });
      // "Valider" : le résultat retourné EST celui de la chaîne hypothétique, tel quel —
      // aucune réinterprétation au passage.
      expect(result).toEqual(ok());
    });

    it('retourne fidèlement un échec de validation, avec sa raison', async () => {
      const candidateBuild = fakeBuild({ validate: () => fail('Une orientation est requise pour le Bélier') });
      mockCatalogService.getAmeliorationByNomInterne.mockReturnValue(ameliorationChenilles);
      mockDecoratorFactory.wrap.mockReturnValue(candidateBuild);

      const result = await service.canAddImprovement(7, 42, 'belier');

      expect(result).toEqual(fail('Une orientation est requise pour le Bélier'));
    });

    it('refuse — POOL D\'EMPLACEMENTS PARTAGÉ — si chaîne + armes déjà montées dépassent la capacité, MÊME quand la chaîne d\'améliorations est par ailleurs cohérente', async () => {
      // `baseStats.emplacements` = 5 (cf. `statsParDefaut`). La chaîne candidate
      // déclare occuper 4 emplacements (`totalEmplacements`), et le véhicule porte
      // déjà une arme qui en consomme 2 (`installedMitrailleuse` → `armeMitrailleuse
      // .emplacement` = 1... ici doublée pour dépasser nettement) : 4 + 2 = 6 > 5.
      // `validate()` de la chaîne d'améliorations dit pourtant "ok" — exactement le
      // cas que `VehicleBuild.totalEmplacements()` NE PEUT PAS, structurellement,
      // détecter seul (il ignore tout des armes, cf. son en-tête).
      const vehiculeAvecArmes = {
        ...mockVehicle,
        weapons: [installedMitrailleuse, installedMitrailleuse],
      };
      mockVehicleRepo.findOne.mockResolvedValue(vehiculeAvecArmes);
      mockCatalogService.getArmeByNomInterne.mockReturnValue(armeMitrailleuse);
      mockCatalogService.getAmeliorationByNomInterne.mockReturnValue(ameliorationChenilles);
      mockDecoratorFactory.wrap.mockReturnValue(
        fakeBuild({ validate: () => ok(), totalEmplacements: () => 4 }),
      );

      const result = await service.canAddImprovement(7, 42, 'chenilles');

      expect(result).toEqual({
        ok: false,
        reason: expect.stringContaining('Emplacements insuffisants'),
      });
      // La vérification du pool partagé se fonde sur `weaponSlotsOf` — donc sur
      // les armes RÉELLEMENT chargées par `findOneForUser` (cf. son commentaire :
      // c'est précisément pourquoi `weapons: true` y est désormais systématique).
      expect(mockCatalogService.getArmeByNomInterne).toHaveBeenCalledWith('mitrailleuse');
    });

    it('accepte — POOL D\'EMPLACEMENTS PARTAGÉ — si chaîne + armes tiennent dans la capacité totale du véhicule', async () => {
      // Même mise en scène que ci-dessus, mais cette fois 4 + 1 = 5 ≤ 5 : pile à la limite.
      const vehiculeAvecArme = { ...mockVehicle, weapons: [installedMitrailleuse] };
      mockVehicleRepo.findOne.mockResolvedValue(vehiculeAvecArme);
      mockCatalogService.getArmeByNomInterne.mockReturnValue(armeMitrailleuse);
      mockCatalogService.getAmeliorationByNomInterne.mockReturnValue(ameliorationChenilles);
      mockDecoratorFactory.wrap.mockReturnValue(
        fakeBuild({ validate: () => ok(), totalEmplacements: () => 4 }),
      );

      const result = await service.canAddImprovement(7, 42, 'chenilles');

      expect(result).toEqual(ok());
    });

    it('ne touche JAMAIS au repository — succès ou échec : "retirer dans la foulée" = ne rien persister', async () => {
      mockCatalogService.getAmeliorationByNomInterne.mockReturnValue(ameliorationChenilles);
      mockDecoratorFactory.wrap.mockReturnValue(fakeBuild({ validate: () => fail('Refusé') }));

      await service.canAddImprovement(7, 42, 'chenilles');

      // La chaîne candidate n'a jamais existé qu'en mémoire, le temps de l'appel — il
      // n'y a littéralement rien à "retirer" (cf. commentaire de la méthode).
      expect(mockImprovementRepo.create).not.toHaveBeenCalled();
      expect(mockImprovementRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── addImprovement ──────────────────────────────────────────────────────────

  describe('addImprovement() — persistance conditionnée à la vérification à blanc', () => {
    it('persiste l\'amélioration et retourne le véhicule RECHARGÉ quand canAddImprovement retourne ok', async () => {
      const vehicleRecharge: Vehicle = {
        ...mockVehicle,
        improvements: [{ id: 9, nomInterne: 'chenilles', orientation: 'avant', vehicle: null as never, vehicleId: 7, createdAt: new Date() }],
      };
      // On isole `addImprovement` de la mécanique interne de `canAddImprovement`
      // (déjà testée ci-dessus) — seule l'ORCHESTRATION nous intéresse ici : "persiste
      // si ok, refuse sinon". `vi.spyOn` sur la méthode du service permet ce découplage.
      vi.spyOn(service, 'canAddImprovement').mockResolvedValue(ok());
      mockImprovementRepo.create.mockReturnValue({ vehicleId: 7, nomInterne: 'chenilles', orientation: 'avant' });
      mockImprovementRepo.save.mockResolvedValue(undefined);
      mockVehicleRepo.findOne.mockResolvedValue(vehicleRecharge);

      const result = await service.addImprovement(7, 42, 'chenilles', { orientation: 'avant' });

      expect(mockImprovementRepo.create).toHaveBeenCalledWith({
        vehicleId: 7,
        nomInterne: 'chenilles',
        orientation: 'avant',
      });
      expect(mockImprovementRepo.save).toHaveBeenCalled();
      // RECHARGÉ : pas l'entrée d'origine (`mockVehicle`, sans amélioration), mais le
      // résultat d'un nouvel appel à `findOneForUser` — celui qui inclut la nouveauté.
      expect(result).toEqual(vehicleRecharge);
    });

    it('convertit l\'absence d\'orientation (`undefined`, vocabulaire BuildOptions) en `null` (convention TypeORM "non orientée")', async () => {
      vi.spyOn(service, 'canAddImprovement').mockResolvedValue(ok());
      mockImprovementRepo.create.mockReturnValue({});
      mockImprovementRepo.save.mockResolvedValue(undefined);
      mockVehicleRepo.findOne.mockResolvedValue(mockVehicle);

      await service.addImprovement(7, 42, 'blindage'); // pas d'options → pas d'orientation

      // Conversion SYMÉTRIQUE de celle observée dans `getBuild` (`null → undefined`) —
      // chaque sens du voyage respecte le vocabulaire de sa couche d'arrivée.
      expect(mockImprovementRepo.create).toHaveBeenCalledWith({
        vehicleId: 7,
        nomInterne: 'blindage',
        orientation: null,
      });
    });

    it('lève BadRequestException avec la raison du refus, et ne touche JAMAIS au repository', async () => {
      vi.spyOn(service, 'canAddImprovement').mockResolvedValue(fail('Chenilles incompatibles avec ce véhicule'));

      const promesse = service.addImprovement(7, 42, 'chenilles');

      await expect(promesse).rejects.toThrow(BadRequestException);
      await expect(promesse).rejects.toThrow('Chenilles incompatibles avec ce véhicule');
      // Aucune persistance "partielle" : la vérification précède STRICTEMENT toute écriture.
      expect(mockImprovementRepo.create).not.toHaveBeenCalled();
      expect(mockImprovementRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── getAvailableImprovements ────────────────────────────────────────────────

  describe('getAvailableImprovements() — catalogue filtré par sponsor, avec verdict', () => {
    beforeEach(() => {
      mockVehicleRepo.findOne.mockResolvedValue(mockVehicle);
      mockCatalogService.getVehiculeByNomInterne.mockReturnValue(catalogVehicule);
      mockCatalogService.getSponsor.mockReturnValue(sponsorRutherford);
      mockBuildFactory.create.mockReturnValue(fakeBuild());
    });

    it('résout le sponsor de l\'ÉQUIPE (pas du véhicule) et construit la chaîne actuelle UNE SEULE FOIS', async () => {
      mockDecoratorFactory.wrap.mockReturnValue(fakeBuild({ validate: () => ok() }));

      await service.getAvailableImprovements(7, 42);

      // `vehicle.team.sponsor` — résolu via la relation chargée par `findOneForUser`
      // (cf. commentaire de la méthode : c'est précisément pourquoi `team` y est jointe).
      expect(mockCatalogService.getSponsor).toHaveBeenCalledWith('Rutherford');
      // La chaîne actuelle est assemblée par `getBuild` → `buildFactory.create` —
      // un seul appel, quel que soit le nombre d'items du catalogue du sponsor
      // (ici 3 : Chenilles, Blindage, Tourelle) : c'est tout l'intérêt de `checkCandidate`
      // (cf. son commentaire — éviter un rechargement par item, donc un N+1 requêtes).
      expect(mockBuildFactory.create).toHaveBeenCalledTimes(1);
    });

    it('enveloppe la chaîne actuelle avec CHAQUE amélioration du sponsor et reflète fidèlement le verdict', async () => {
      // Deux verdicts différents selon l'item enveloppé — la Map ci-dessous distingue
      // par `nom_interne` du candidat pour que chaque amelioration reçoive SON résultat.
      const resultats: Record<string, ReturnType<typeof ok> | ReturnType<typeof fail>> = {
        chenilles: fail('Chenilles incompatibles avec ce véhicule'),
        blindage: ok(),
        tourelle: ok(),
      };
      mockDecoratorFactory.wrap.mockImplementation(
        (_inner: VehicleBuild, _amelioration: Amelioration, instance: { nom_interne: string }) =>
          fakeBuild({ validate: () => resultats[instance.nom_interne] }),
      );

      const result = await service.getAvailableImprovements(7, 42);

      // Une ligne par amelioration du catalogue du sponsor — dans l'ORDRE du catalogue,
      // avec exactement les champs attendus par le DTO (cf. `AvailableImprovementDto`).
      expect(result).toEqual([
        {
          nom: 'Chenilles',
          nomInterne: 'chenilles',
          prix: 4,
          emplacement: 1,
          disponible: false,
          raison: 'Chenilles incompatibles avec ce véhicule',
        },
        {
          nom: 'Blindage',
          nomInterne: 'blindage',
          prix: 4,
          emplacement: 1,
          disponible: true,
          raison: undefined,
        },
        {
          nom: 'Tourelle',
          nomInterne: 'tourelle',
          // `prix: "x3"` traverse tel quel — le calcul du coût réel est hors périmètre
          // (cf. commentaire de `AvailableImprovementDto.prix` et plan §4 : reporté au budget).
          prix: 'x3',
          emplacement: 0,
          disponible: true,
          raison: undefined,
        },
      ]);
    });

    it('n\'écrit JAMAIS dans le repository — pure consultation, comme canAddImprovement', async () => {
      mockDecoratorFactory.wrap.mockReturnValue(fakeBuild({ validate: () => ok() }));

      await service.getAvailableImprovements(7, 42);

      expect(mockImprovementRepo.create).not.toHaveBeenCalled();
      expect(mockImprovementRepo.save).not.toHaveBeenCalled();
    });

    it('lève une Error — incohérence de DONNÉES, pas une erreur utilisateur — si le sponsor de l\'équipe est inconnu du catalogue', async () => {
      mockCatalogService.getSponsor.mockReturnValue(undefined);

      // Même raisonnement que `getBuild` pour un véhicule catalogue absent : `sponsor`
      // vient de la BASE (`team.sponsor`), pas d'une saisie utilisateur — un sponsor
      // introuvable signale une désynchronisation catalogue/données, pas une faute du client.
      await expect(service.getAvailableImprovements(7, 42)).rejects.toThrow(/Rutherford/);
      expect(mockBuildFactory.create).not.toHaveBeenCalled();
    });

    it('lève NotFoundException si le véhicule n\'appartient pas à l\'utilisateur — avant toute consultation du catalogue', async () => {
      mockVehicleRepo.findOne.mockResolvedValue(null);

      await expect(service.getAvailableImprovements(7, 99)).rejects.toThrow(NotFoundException);
      expect(mockCatalogService.getSponsor).not.toHaveBeenCalled();
    });
  });

  // ── removeImprovement ───────────────────────────────────────────────────────

  describe('removeImprovement() — retrait toujours permis, sans vérification de règle', () => {
    const vehicleAvecChenilles: Vehicle = { ...mockVehicle, improvements: [installedChenilles] };

    it('retire l\'amélioration si elle existe SUR ce véhicule (appartenant à l\'utilisateur)', async () => {
      mockVehicleRepo.findOne.mockResolvedValue(vehicleAvecChenilles);
      mockImprovementRepo.remove.mockResolvedValue(undefined);

      await service.removeImprovement(7, 1, 42);

      // `findOneForUser` vérifie déjà l'appartenance ET charge `improvements` —
      // on localise la cible directement dans la relation, sans second aller-
      // retour SQL ciblé sur `VehicleImprovement` (cf. en-tête de la méthode).
      expect(mockVehicleRepo.findOne).toHaveBeenCalledWith({
        where: { id: 7, team: { userId: 42 } },
        relations: { team: true, improvements: true, weapons: true },
      });
      expect(mockImprovementRepo.remove).toHaveBeenCalledWith(installedChenilles);
    });

    it('lève NotFoundException si l\'amélioration n\'existe pas SUR ce véhicule, sans toucher au repository', async () => {
      // Le véhicule existe et appartient à l'utilisateur, mais ne porte PAS
      // l'amélioration #999 — qu'elle soit totalement inexistante ou posée sur
      // un AUTRE véhicule (même de cet utilisateur), le verdict est identique
      // par conception (cf. en-tête : non-divulgation, même principe que `findOneForUser`).
      mockVehicleRepo.findOne.mockResolvedValue(vehicleAvecChenilles);

      await expect(service.removeImprovement(7, 999, 42)).rejects.toThrow(NotFoundException);
      expect(mockImprovementRepo.remove).not.toHaveBeenCalled();
    });

    it('lève NotFoundException si le véhicule n\'appartient pas à l\'utilisateur — avant toute recherche d\'amélioration', async () => {
      mockVehicleRepo.findOne.mockResolvedValue(null);

      await expect(service.removeImprovement(7, 1, 99)).rejects.toThrow(NotFoundException);
      expect(mockImprovementRepo.remove).not.toHaveBeenCalled();
    });
  });

  // ── remove ──────────────────────────────────────────────────────────────────

  describe('remove() — suppression du véhicule (cascade sur improvements/weapons)', () => {
    it('supprime le véhicule s\'il appartient à l\'utilisateur', async () => {
      mockVehicleRepo.findOne.mockResolvedValue(mockVehicle);
      mockVehicleRepo.remove.mockResolvedValue(undefined);

      await service.remove(7, 42);

      // Mirroir de `findOneForUser` : même filtre `Vehicle → Team → User`.
      // La cascade TypeORM (`onDelete: 'CASCADE'`, cf. vehicle.entity.ts)
      // gère seule la suppression d'`improvements`/`weapons` — rien à
      // orchestrer manuellement ici.
      expect(mockVehicleRepo.findOne).toHaveBeenCalledWith({
        where: { id: 7, team: { userId: 42 } },
        relations: { team: true, improvements: true, weapons: true },
      });
      expect(mockVehicleRepo.remove).toHaveBeenCalledWith(mockVehicle);
    });

    it('lève NotFoundException si le véhicule est introuvable ou appartient à un autre utilisateur, sans rien supprimer', async () => {
      mockVehicleRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(999, 42)).rejects.toThrow(NotFoundException);
      expect(mockVehicleRepo.remove).not.toHaveBeenCalled();
    });
  });
});
