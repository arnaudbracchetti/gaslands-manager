/**
 * VehicleService — orchestration métier du module Vehicle.
 *
 * Trois responsabilités, clairement séparées :
 *  1. Accès aux données — charger un véhicule en vérifiant son appartenance
 *     (même principe de sécurité que `TeamService.findOneForUser`, cf. §"sécurité").
 *  2. Assemblage — reconstituer la chaîne `VehicleBuild` d'un véhicule persisté
 *     (délégué à `VehicleBuildFactory`, cf. `getBuild`).
 *  3. Vérification et persistance des améliorations — `canAddImprovement` /
 *     `addImprovement`, qui appliquent la mécanique "envelopper PUIS valider"
 *     (cf. plan d'architecture, correction du bug structurel "première pose").
 *
 * Sécurité : comme `TeamService`, toute méthode qui accède à un véhicule précis
 * vérifie son appartenance — ici via la chaîne `Vehicle → Team → User`, puisque
 * `Vehicle` ne porte pas de `userId` direct (seulement `teamId`). Toute tentative
 * d'accès à un véhicule d'un autre utilisateur lève `NotFoundException` (HTTP 404),
 * jamais 403 — ne pas révéler l'EXISTENCE d'une ressource qu'on ne possède pas.
 */

import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle, VehicleImprovement } from './vehicle.entity';
import { CatalogService } from '../catalog/catalog.service';
import { TeamService } from '../team/team.service';
import { VehicleBuildFactory } from './vehicle-build.factory';
import { ImprovementDecoratorFactory } from './improvement-decorator.factory';
import type { Amelioration } from '../catalog/catalog.interfaces';
import type { AvailableImprovementDto } from './dto/available-improvement.dto';
import type { VehicleDto } from './dto/vehicle.dto';
import type { VehicleImprovementDto } from './dto/vehicle-improvement.dto';
import type { WeaponDto } from '../weapon/dto/weapon.dto';
import {
  fail,
  ok,
  type BuildOptions,
  type InstalledImprovement,
  type RuleResult,
  type VehicleBuild,
} from './vehicle-build';

@Injectable()
export class VehicleService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(VehicleImprovement)
    private readonly improvementRepo: Repository<VehicleImprovement>,
    private readonly catalogService: CatalogService,
    // Nécessaire pour vérifier l'appartenance de l'équipe AVANT de créer/lister
    // ses véhicules (cf. `findAllForTeam`/`create` ci-dessous) — `Vehicle` ne
    // porte pas `userId` directement, mais `Team` si. Pour éviter tout cycle
    // d'imports `TeamModule ↔ VehicleModule`, `TeamModule` exporte `TeamService`
    // sans importer `VehicleModule` (cf. son en-tête).
    private readonly teamService: TeamService,
    private readonly buildFactory: VehicleBuildFactory,
    private readonly decoratorFactory: ImprovementDecoratorFactory,
  ) {}

  // ── Accès aux données ───────────────────────────────────────────────────────

  /**
   * Liste les véhicules d'une équipe — réservé au propriétaire de l'équipe.
   *
   * `teamService.findOneForUser` vérifie l'appartenance et lève `NotFoundException`
   * si l'équipe n'existe pas ou n'appartient pas à `userId`.
   * `relations: { improvements: true, weapons: true }` : charge les deux relations
   * pour éviter un second aller-retour par véhicule (nécessaire à `toVehicleDto`).
   * Les entités retournées sont hydratées (cf. `hydrateVehicle`).
   */
  async findAllForTeam(teamId: number, userId: number): Promise<Vehicle[]> {
    await this.teamService.findOneForUser(teamId, userId);
    const vehicles = await this.vehicleRepo.find({
      where: { teamId },
      relations: { improvements: true, weapons: true },
    });
    vehicles.forEach((v) => this.hydrateVehicle(v));
    return vehicles;
  }

  /**
   * Crée un véhicule "nu" (sans arme ni amélioration) dans une équipe — première
   * étape du flux de configuration : on choisit d'abord le TYPE de véhicule,
   * on l'équipe ensuite (cf. plan, "Décisions actées" — persistance immédiate).
   *
   * Trois vérifications avant la moindre écriture :
   *  1. l'équipe appartient à l'utilisateur (`teamService.findOneForUser` —
   *     lève déjà `NotFoundException` sinon, comportement hérité tel quel) ;
   *  2. `nomInterne` correspond à un véhicule du CATALOGUE (sinon le sponsor
   *     ne pourrait de toute façon pas l'autoriser — message dédié, plus
   *     clair que "non autorisé pour ce sponsor") ;
   *  3. ce véhicule fait partie de ceux AUTORISÉS PAR LE SPONSOR de l'équipe
   *     — la même règle que celle qui filtre `sponsor.vehicules` côté
   *     catalogue (cf. `CatalogService`, relations pré-résolues au démarrage).
   *
   * Erreurs utilisateur (entrée invalide) ⇒ `BadRequestException` — à
   * distinguer de `NotFoundException` (ressource absente/non possédée).
   */
  async create(teamId: number, userId: number, nomInterne: string): Promise<Vehicle> {
    const team = await this.teamService.findOneForUser(teamId, userId);

    const catalogVehicule = this.catalogService.getVehiculeByNomInterne(nomInterne);
    if (!catalogVehicule) {
      throw new BadRequestException(`Véhicule inconnu du catalogue : "${nomInterne}"`);
    }

    const sponsor = this.catalogService.getSponsor(team.sponsor);
    if (!sponsor) {
      // Incohérence de données (sponsor enregistré inconnu du catalogue) — pas
      // une erreur utilisateur, même raisonnement que `getAvailableImprovements`.
      throw new Error(`Sponsor catalogue inconnu : "${team.sponsor}" (équipe #${teamId})`);
    }
    const autorise = sponsor.vehicules.some((v) => v.nom_interne === nomInterne);
    if (!autorise) {
      throw new BadRequestException(
        `Le véhicule "${catalogVehicule.nom}" n'est pas autorisé pour le sponsor "${sponsor.nom}"`,
      );
    }

    const vehicle = this.vehicleRepo.create({ teamId, nomInterne });
    await this.vehicleRepo.save(vehicle);

    // Améliorations par défaut — intégrées au profil de base du véhicule :
    // coût zéro, non supprimables, ne consomment pas de slot achetable.
    // Insérées immédiatement après la création, avant le rechargement final.
    for (const defautNomInterne of catalogVehicule.ameliorations_defaut ?? []) {
      const defaultImp = this.improvementRepo.create({
        vehicleId: vehicle.id,
        nomInterne: defautNomInterne,
        orientation: null,
        estDefaut: true,
      });
      await this.improvementRepo.save(defaultImp);
    }

    // Recharge l'entité avec ses relations : `save()` retourne le véhicule
    // "nu", avec `improvements`/`weapons` à `undefined` (TypeORM ne matérialise
    // pas de tableaux vides pour des relations OneToMany non chargées). Le
    // frontend suppose toujours des tableaux (cf. `Vehicle` dans
    // vehicle-builder.model.ts) — même contrat que `addImprovement`/`addWeapon`,
    // qui rechargent systématiquement via `findOneForUser` après persistance.
    return this.findOneForUser(vehicle.id, userId);
  }

  /**
   * Charge un véhicule par son id, uniquement s'il appartient (via son équipe)
   * à l'utilisateur connecté. Filtre via `team: { userId }` — `Vehicle` ne porte
   * pas `userId` directement. Charge `team`, `improvements` et `weapons` car
   * nécessaires à `getBuild`, aux calculs d'emplacements et à `WeaponService`.
   *
   * Lève `NotFoundException` (HTTP 404) si introuvable ou si l'appartenance
   * échoue — les deux cas sont indiscernables pour l'appelant, par conception.
   */
  async findOneForUser(id: number, userId: number): Promise<Vehicle> {
    const vehicle = await this.vehicleRepo.findOne({
      where: { id, team: { userId } },
      relations: { team: true, improvements: true, weapons: true },
    });
    if (!vehicle) {
      throw new NotFoundException(`Véhicule #${id} introuvable`);
    }
    this.hydrateVehicle(vehicle);
    return vehicle;
  }

  // ── Hydratation et sérialisation ────────────────────────────────────────────

  /**
   * Hydrate les propriétés transientes d'un véhicule après chargement depuis la base.
   *
   * `ameliorationCatalogue`, `weaponCatalogueMonte` et `armeCatalogue` sont des propriétés
   * NON persistées (aucun `@Column` — cf. les entités). TypeORM ne les renseigne jamais ;
   * c'est cette méthode qui les résout depuis le catalogue en mémoire, permettant ensuite
   * aux getters `prix` des entités de traverser le graphe d'objet.
   *
   * Ordre critique : les armes sont hydratées EN PREMIER car `weaponCatalogueMonte` du
   * getter `prix` de la Tourelle lit `armeCatalogue` de l'arme — si les améliorations
   * étaient traitées en premier, ce champ serait encore `undefined` au moment du calcul.
   *
   * Appelée systématiquement après tout chargement depuis la base : `findOneForUser`
   * (usage individuel) et `findAllForTeam` (usage liste).
   */
  private hydrateVehicle(vehicle: Vehicle): void {
    // 1. Armes en premier — leur `armeCatalogue` est consulté par le getter `prix`
    //    de la Tourelle (via `weaponCatalogueMonte`) dans la passe suivante.
    for (const weapon of vehicle.weapons) {
      weapon.armeCatalogue = this.catalogService.getArmeByNomInterne(weapon.nomInterne);
    }
    // 2. Améliorations ensuite — hydratation catalogue + résolution de l'arme Tourelle.
    for (const imp of vehicle.improvements) {
      imp.ameliorationCatalogue = this.catalogService.getAmeliorationByNomInterne(imp.nomInterne);
      // Pour une Tourelle avec arme assignée : résoudre l'entrée catalogue de l'arme
      // afin que le getter `prix` puisse calculer 3 × arme.prix.
      if (imp.nomInterne === 'tourelle' && imp.weaponNomInterne) {
        imp.weaponCatalogueMonte =
          this.catalogService.getArmeByNomInterne(imp.weaponNomInterne) ?? undefined;
      }
    }
  }

  /**
   * Mappe un véhicule hydraté vers un DTO sérialisable pour les réponses HTTP.
   *
   * Les getters TypeScript (`prix`, `emplacement` sur `VehicleImprovement` et `prix`
   * sur `Weapon`) ne sont PAS sérialisés par `JSON.stringify` : ils vivent sur le
   * PROTOTYPE de la classe, pas comme propriétés propres de l'instance. Ce mapper
   * les appelle explicitement et produit des objets plain que NestJS sérialise
   * fidèlement. Aucune règle de gestion ici : juste lecture des getters.
   *
   * Requiert que `vehicle` ait été hydraté au préalable (cf. `hydrateVehicle`) :
   * les getters de `VehicleImprovement` lisent `ameliorationCatalogue`, et
   * celui de `Weapon` lit `armeCatalogue` — non hydraté, ils retournent `0`.
   */
  toVehicleDto(vehicle: Vehicle): VehicleDto {
    const improvements: VehicleImprovementDto[] = vehicle.improvements.map((imp) => ({
      id: imp.id,
      nomInterne: imp.nomInterne,
      orientation: imp.orientation,
      vehicleId: imp.vehicleId,
      createdAt: imp.createdAt,
      estDefaut: imp.estDefaut,
      prix: imp.prix,               // ← getter : 0 si défaut/orpheline, 3×arme si Tourelle assignée, prix catalogue sinon
      emplacement: imp.emplacement,  // ← getter : 0 si défaut, valeur catalogue sinon
      weaponNomInterne: imp.weaponNomInterne ?? null, // ← null pour tout sauf Tourelle assignée
    }));

    const weapons: WeaponDto[] = vehicle.weapons.map((w) => ({
      id: w.id,
      nomInterne: w.nomInterne,
      orientation: w.orientation,
      vehicleId: w.vehicleId,
      createdAt: w.createdAt,
      prix: w.prix, // ← getter de l'entité hydratée
    }));

    return {
      id: vehicle.id,
      nomInterne: vehicle.nomInterne,
      teamId: vehicle.teamId,
      createdAt: vehicle.createdAt,
      improvements,
      weapons,
    };
  }

  // ── Emplacements partagés (armes ET améliorations) ──────────────────────────

  /**
   * Emplacements consommés par les améliorations RÉELLEMENT posées sur ce véhicule.
   * Helper partagé entre `checkCandidate` et `WeaponService`, qui n'a pas accès à
   * la chaîne `VehicleBuild` (les armes ne sont pas des décorateurs).
   *
   * `vehicle.improvements` doit avoir été chargé au préalable (cf. `findOneForUser`).
   */
  improvementSlotsOf(vehicle: Vehicle): number {
    // Les améliorations par défaut (`estDefaut: true`) font partie du profil de
    // base du véhicule — elles ne consomment PAS de slot achetable. On les filtre
    // pour ne compter que les emplacements des améliorations achetées par le joueur.
    return vehicle.improvements
      .filter((i) => !i.estDefaut)
      .reduce((total, improvement) => {
        const amelioration = this.catalogService.getAmeliorationByNomInterne(improvement.nomInterne);
        // Incohérence de données (catalogue modifié après coup...) — même posture
        // que `getBuild` : on ne masque pas le problème, on le signale clairement.
        if (!amelioration) {
          throw new Error(
            `Amélioration catalogue inconnue : "${improvement.nomInterne}" (véhicule #${vehicle.id})`,
          );
        }
        return total + amelioration.emplacement;
      }, 0);
  }

  /**
   * Emplacements consommés par les armes montées sur ce véhicule — même logique
   * que `improvementSlotsOf`, pour le pool partagé avec les améliorations.
   *
   * Deux sources d'armes sont comptabilisées :
   *  1. Les entités `Weapon` classiques (`vehicle.weapons`).
   *  2. Les armes assignées à une Tourelle achetée (`VehicleImprovement.weaponNomInterne`
   *     quand `nomInterne === 'tourelle'` et `!estDefaut`). Ces armes ne sont pas des
   *     entités `Weapon` — elles n'ont pas leur propre ligne en base — mais elles
   *     consomment quand même des emplacements comme n'importe quelle arme normale.
   *     Les Tourelles intégrées au profil de base (`estDefaut: true`) sont exclues :
   *     leur arme fait partie du profil catalogue et ne compte pas dans le pool achetable.
   *
   * `vehicle.weapons` et `vehicle.improvements` doivent avoir été chargés au préalable
   * (cf. `findOneForUser`).
   */
  weaponSlotsOf(vehicle: Vehicle): number {
    // 1. Armes classiques — entités Weapon persistées.
    const fromWeapons = vehicle.weapons.reduce((total, weapon) => {
      const arme = this.catalogService.getArmeByNomInterne(weapon.nomInterne);
      if (!arme) {
        throw new Error(
          `Arme catalogue inconnue : "${weapon.nomInterne}" (véhicule #${vehicle.id})`,
        );
      }
      return total + arme.emplacement;
    }, 0);

    // 2. Armes sur Tourelles achetées — référencées par `weaponNomInterne` sur l'amélioration.
    //    Même règle qu'une arme classique : son `emplacement` catalogue compte dans le pool.
    const fromTourelles = vehicle.improvements
      .filter((imp) => imp.nomInterne === 'tourelle' && imp.weaponNomInterne !== null && !imp.estDefaut)
      .reduce((total, imp) => {
        const arme = this.catalogService.getArmeByNomInterne(imp.weaponNomInterne!);
        if (!arme) {
          throw new Error(
            `Arme catalogue inconnue sur Tourelle : "${imp.weaponNomInterne}" (véhicule #${vehicle.id})`,
          );
        }
        return total + arme.emplacement;
      }, 0);

    return fromWeapons + fromTourelles;
  }

  // ── Assemblage ──────────────────────────────────────────────────────────────

  /**
   * Reconstitue la chaîne `VehicleBuild` d'un véhicule déjà chargé (avec ses
   * `improvements`) : résout son type catalogue par `nom_interne`, convertit ses
   * améliorations persistées vers le vocabulaire `InstalledImprovement` du module
   * `vehicle-build` (`orientation: null → undefined` — chaque couche garde son
   * propre vocabulaire, cf. note de `vehicle.entity.ts`), puis délègue l'empilement
   * à `VehicleBuildFactory`.
   *
   * Synchrone et pure (aucun accès BDD) : `vehicle` doit avoir été chargé au
   * préalable AVEC sa relation `improvements` (cf. `findOneForUser`).
   */
  getBuild(vehicle: Vehicle): VehicleBuild {
    const catalogVehicule = this.catalogService.getVehiculeByNomInterne(vehicle.nomInterne);
    if (!catalogVehicule) {
      // Incohérence de données (catalogue modifié après coup...), pas une erreur
      // utilisateur — cf. même raisonnement dans `VehicleBuildFactory.create`.
      throw new Error(
        `Véhicule catalogue inconnu : "${vehicle.nomInterne}" (véhicule #${vehicle.id})`,
      );
    }

    // Les améliorations par défaut sont exclues de la chaîne VehicleBuild :
    // elles n'ont pas de comportement métier (pas de `comportement` dans le catalogue
    // pour "arceaux" ou "tourelle" — améliorations neutres). Les inclure ferait
    // compter leurs emplacements dans `totalEmplacements()`, faussant la vérification
    // du pool partagé. Leur règle de jeu est décrite dans `regles` du catalogue
    // (texte informatif), pas dans un décorateur — aucun effet mécanique à empiler.
    const installed: InstalledImprovement[] = vehicle.improvements
      .filter((vi) => !vi.estDefaut)
      .map(
        (vi: VehicleImprovement): InstalledImprovement => ({
          nom_interne: vi.nomInterne,
          orientation: vi.orientation ?? undefined,
        }),
      );

    return this.buildFactory.create(catalogVehicule, installed);
  }

  // ── Vérification et persistance des améliorations ──────────────────────────

  /**
   * Vérification à blanc — construit la chaîne HYPOTHÉTIQUE (véhicule réel +
   * candidat enveloppé par-dessus) et la valide, SANS PERSISTER.
   *
   * "Ajouter, valider, retirer dans la foulée" (votre description) — sauf qu'il
   * n'y a rien à retirer : `candidateBuild` n'existe qu'en mémoire, le temps de
   * cet appel ; `vehicle` (et sa chaîne réelle) n'est jamais modifié.
   *
   * Retourne un `RuleResult` (jamais un simple booléen) : `reason` alimente aussi
   * bien le message de l'éventuelle `BadRequestException` que l'UI ("pourquoi
   * cette option est-elle grisée ?").
   */
  async canAddImprovement(
    vehicleId: number,
    userId: number,
    nomInterne: string,
    opts?: BuildOptions,
  ): Promise<RuleResult> {
    const vehicle = await this.findOneForUser(vehicleId, userId);

    const amelioration = this.catalogService.getAmeliorationByNomInterne(nomInterne);
    if (!amelioration) {
      // Erreur utilisateur cette fois (nomInterne fourni par le client) — exprimée
      // comme un RuleResult, pour que addImprovement la transforme uniformément
      // en BadRequestException, sans distinguer "catalogue inconnu" de "règle violée".
      return fail(`Amélioration inconnue du catalogue : "${nomInterne}"`);
    }

    return this.checkCandidate(vehicle, this.getBuild(vehicle), amelioration, opts);
  }

  /**
   * Vérification à blanc en mémoire : enveloppe `currentBuild` avec le décorateur
   * du candidat, valide la chaîne hypothétique, SANS PERSISTER. Appelée une fois
   * depuis `canAddImprovement`, ou N fois depuis `getAvailableImprovements` sur la
   * même chaîne déjà construite — évite de recharger le véhicule à chaque itération.
   *
   * ⚠️ `vehicle` est requis EN PLUS de `currentBuild` : la chaîne `VehicleBuild`
   * ne connaît QUE les améliorations. Or `Vehicule.emplacements` est un pool PARTAGÉ
   * entre améliorations ET armes : valider la chaîne seule ne suffit pas — il faut
   * vérifier que la chaîne étendue tient encore dans ce pool COMMUN aux armes déjà
   * montées. Cette vérification est placée APRÈS `validate()` pour ne pas masquer
   * une vraie erreur de règle derrière un message générique de dépassement d'emplacements.
   */
  private checkCandidate(
    vehicle: Vehicle,
    currentBuild: VehicleBuild,
    amelioration: Amelioration,
    opts?: BuildOptions,
  ): RuleResult {
    // "Ajouter" : on enveloppe D'ABORD avec le décorateur du candidat — il existe
    // donc désormais dans une chaîne hypothétique, et se validera lui-même au
    // passage (cf. plan : correction du bug "première pose" jamais contrôlée).
    const candidateInstance: InstalledImprovement = {
      nom_interne: amelioration.nom_interne,
      orientation: opts?.orientation,
    };
    const candidateBuild = this.decoratorFactory.wrap(currentBuild, amelioration, candidateInstance);

    // "Valider" : la chaîne d'améliorations est-elle cohérente avec ELLE-MÊME ?
    const chainResult = candidateBuild.validate();
    if (!chainResult.ok) {
      return chainResult;
    }

    // Et MAINTENANT, le pool d'emplacements PARTAGÉ : la chaîne candidate
    // (améliorations, candidat inclus) PLUS les armes déjà montées tiennent-elles
    // dans la capacité totale du véhicule ? `baseStats.emplacements` — pas
    // `stats.emplacements` — car ce total est une caractéristique D'ORIGINE du
    // véhicule (rien dans Gaslands ne l'augmente ; cf. la distinction baseStats/
    // stats documentée dans `VehicleBuild`).
    const totalDemande = candidateBuild.totalEmplacements() + this.weaponSlotsOf(vehicle);
    if (totalDemande > candidateBuild.baseStats.emplacements) {
      return fail(
        `Emplacements insuffisants : ${totalDemande}/${candidateBuild.baseStats.emplacements} requis avec "${amelioration.nom}"`,
      );
    }

    return ok();
  }

  /**
   * Liste, pour le sponsor de l'équipe, chaque amélioration de son catalogue
   * accompagnée du verdict "puis-je l'ajouter MAINTENANT à ce véhicule ?" — la
   * même question que `canAddImprovement`, posée pour CHAQUE item du catalogue
   * filtré, en réutilisant la chaîne actuelle déjà construite (cf. `checkCandidate`).
   *
   * ⚠️ Note de conception — l'orientation n'est PAS fournie ici : cette liste répond
   * à "cette amélioration est-elle accessible à ce véhicule, par principe ?", pas
   * "puis-je l'acheter avec TEL réglage ?" (question qui ne se pose qu'au moment de
   * l'achat, une fois l'item choisi). Conséquence assumée : Bélier/Bélier Explosif
   * apparaîtront avec `disponible: false` et la raison "Une orientation est requise
   * pour…" — un message qui dit "il vous manque une information", pas "c'est interdit".
   * `RuleResult` ne distingue pas ces deux nuances ; les départager finement dépasserait
   * le périmètre de ce plan (cf. note Tourelle, §4 — un sujet à reprendre plus tard,
   * pas un défaut à corriger dans l'urgence).
   *
   * Lève une `Error` (incohérence de données) si le sponsor de l'équipe est inconnu
   * du catalogue — même raisonnement que `getBuild` pour un véhicule catalogue absent.
   */
  async getAvailableImprovements(vehicleId: number, userId: number): Promise<AvailableImprovementDto[]> {
    const vehicle = await this.findOneForUser(vehicleId, userId);

    const sponsor = this.catalogService.getSponsor(vehicle.team.sponsor);
    if (!sponsor) {
      throw new Error(
        `Sponsor catalogue inconnu : "${vehicle.team.sponsor}" (équipe #${vehicle.teamId})`,
      );
    }

    // Construite UNE SEULE FOIS — réutilisée pour chaque vérification ci-dessous
    // (cf. commentaire de `checkCandidate` : la chaîne réelle ne change pas d'un
    // item à l'autre du catalogue, inutile de la reconstruire à chaque itération).
    const currentBuild = this.getBuild(vehicle);

    return sponsor.ameliorations.map((amelioration): AvailableImprovementDto => {
      const result = this.checkCandidate(vehicle, currentBuild, amelioration);
      return {
        nom: amelioration.nom,
        nomInterne: amelioration.nom_interne,
        prix: amelioration.prix,
        emplacement: amelioration.emplacement,
        description: amelioration.description,
        disponible: result.ok,
        raison: result.ok ? undefined : result.reason,
      };
    });
  }

  /**
   * Ajout réel d'une amélioration — ne persiste QUE si la vérification à blanc
   * ci-dessus est positive. Lève `BadRequestException` sinon, avec la raison
   * fournie par `RuleResult.reason` (cf. plan, "Le contrat révisé").
   *
   * Retourne le véhicule rechargé (avec sa nouvelle amélioration) : la prochaine
   * reconstruction de la chaîne (`getBuild`) l'inclura, désormais légitime —
   * persistée APRÈS validation, jamais avant.
   */
  async addImprovement(
    vehicleId: number,
    userId: number,
    nomInterne: string,
    opts?: BuildOptions,
  ): Promise<Vehicle> {
    const result = await this.canAddImprovement(vehicleId, userId, nomInterne, opts);
    if (!result.ok) {
      throw new BadRequestException(result.reason);
    }

    const improvement = this.improvementRepo.create({
      vehicleId,
      nomInterne,
      orientation: opts?.orientation ?? null,
    });
    await this.improvementRepo.save(improvement);

    return this.findOneForUser(vehicleId, userId);
  }

  // ── Retrait d'équipement et suppression ─────────────────────────────────────

  /**
   * Retire une amélioration posée sur ce véhicule.
   *
   * Aucune vérification de règle métier au préalable — comme `WeaponService.
   * removeWeapon` (cf. son en-tête) : retirer un équipement est TOUJOURS permis,
   * seul l'AJOUT est soumis à validation (`canAddImprovement`/`checkCandidate`).
   * Retirer ne peut JAMAIS rendre une chaîne déjà valide invalide — au contraire,
   * cela ne fait que libérer des emplacements et retirer des effets.
   *
   * `findOneForUser` vérifie déjà l'appartenance ET charge `vehicle.improvements`
   * — la relation est directement réutilisée pour localiser l'amélioration visée
   * (pas de second aller-retour SQL ciblé sur `VehicleImprovement`).
   *
   * Lève `NotFoundException` si l'amélioration n'existe pas SUR CE véhicule —
   * qu'elle n'existe pas du tout, ou qu'elle appartienne à un autre véhicule
   * (même de l'utilisateur courant) : les deux cas sont indiscernables pour
   * l'appelant, par conception (même principe de non-divulgation que `findOneForUser`).
   */
  async removeImprovement(vehicleId: number, improvementId: number, userId: number): Promise<void> {
    const vehicle = await this.findOneForUser(vehicleId, userId);

    const improvement = vehicle.improvements.find((i) => i.id === improvementId);
    if (!improvement) {
      throw new NotFoundException(`Amélioration #${improvementId} introuvable sur le véhicule #${vehicleId}`);
    }

    // Les améliorations intégrées au profil de base ne peuvent pas être retirées :
    // elles font partie du véhicule lui-même, pas de son équipement achetable.
    // On lève une 403 (et non 404) : l'amélioration EXISTE, elle est simplement
    // protégée — le masquage 404 ne s'applique qu'aux ressources qu'on ne POSSÈDE pas.
    if (improvement.estDefaut) {
      throw new ForbiddenException(
        `"${improvement.nomInterne}" fait partie du profil de base de ce véhicule et ne peut pas être retirée.`,
      );
    }

    await this.improvementRepo.remove(improvement);
  }

  // ── Gestion de la Tourelle — assignation / désassignation d'arme ─────────────

  /**
   * Assigne une arme de catalogue à une Tourelle (état orphelin → assigné).
   *
   * L'arme est stockée comme référence `nom_interne` string sur `VehicleImprovement`,
   * pas comme entité `Weapon` séparée : la Tourelle porte le coût total (3×) — cf.
   * note architecturale dans `vehicle.entity.ts` (VehicleImprovement.weaponNomInterne).
   *
   * Validations dans l'ordre :
   *  1. L'amélioration existe sur ce véhicule (appartient à l'utilisateur).
   *  2. C'est bien une Tourelle (`nomInterne === 'tourelle'`).
   *  3. L'arme existe dans le catalogue.
   *  4. L'arme est autorisée par le sponsor de l'équipe.
   *  5. L'arme n'est pas de type `équipage` (arc 360° natif — Tourelle sans objet).
   *  6. Le pool d'emplacements partagé n'est pas dépassé avec cette arme supplémentaire.
   *     L'arme sur Tourelle consomme les mêmes slots qu'une arme normale (cf. `weaponSlotsOf`).
   *     Seules les Tourelles intégrées (`estDefaut: true`) sont exemptées — leur arme
   *     fait partie du profil de base du véhicule.
   */
  async assignWeaponToTourelle(
    vehicleId: number,
    improvementId: number,
    weaponNomInterne: string,
    userId: number,
  ): Promise<Vehicle> {
    const vehicle = await this.findOneForUser(vehicleId, userId);

    const improvement = vehicle.improvements.find((i) => i.id === improvementId);
    if (!improvement) {
      throw new NotFoundException(
        `Amélioration #${improvementId} introuvable sur le véhicule #${vehicleId}`,
      );
    }
    if (improvement.nomInterne !== 'tourelle') {
      throw new BadRequestException("Cette amélioration n'est pas une Tourelle");
    }

    const arme = this.catalogService.getArmeByNomInterne(weaponNomInterne);
    if (!arme) {
      throw new BadRequestException(`Arme inconnue du catalogue : "${weaponNomInterne}"`);
    }

    // Vérification du sponsor — même logique que `WeaponService.canAddWeapon`
    const sponsor = this.catalogService.getSponsor(vehicle.team.sponsor);
    if (!sponsor) {
      throw new Error(`Sponsor catalogue inconnu : "${vehicle.team.sponsor}" (équipe #${vehicle.teamId})`);
    }
    const autorisee = sponsor.armes.some((a) => a.nom_interne === weaponNomInterne);
    if (!autorisee) {
      throw new BadRequestException(
        `L'arme "${arme.nom}" n'est pas autorisée pour le sponsor "${sponsor.nom}"`,
      );
    }

    // Les armes d'équipage tirent déjà à 360° — la Tourelle ne leur apporte rien.
    // Bloquer explicitement plutôt que d'accepter silencieusement une règle incorrecte.
    if (arme.type === 'équipage') {
      throw new BadRequestException(
        `Les armes d'équipage ont déjà un arc de tir 360° — la Tourelle ne s'applique pas`,
      );
    }

    // Vérification du pool d'emplacements partagé — l'arme sur Tourelle consomme
    // ses slots catalogue, exactement comme une arme classique. On simule l'état
    // "après assignation" en affectant temporairement `weaponNomInterne` avant de
    // recalculer `weaponSlotsOf`, puis on restaure si le contrôle échoue.
    // Les Tourelles `estDefaut` sont exclues par `weaponSlotsOf` — pas besoin de
    // distinguer ici.
    if (!improvement.estDefaut) {
      const previousWeapon = improvement.weaponNomInterne;
      improvement.weaponNomInterne = weaponNomInterne; // simulation
      const build = this.getBuild(vehicle);
      const totalDemande = build.totalEmplacements() + this.weaponSlotsOf(vehicle);
      improvement.weaponNomInterne = previousWeapon; // restauration

      if (totalDemande > build.baseStats.emplacements) {
        throw new BadRequestException(
          `Emplacements insuffisants : ${totalDemande}/${build.baseStats.emplacements} requis avec "${arme.nom}" sur Tourelle`,
        );
      }
    }

    improvement.weaponNomInterne = weaponNomInterne;
    await this.improvementRepo.save(improvement);
    return this.findOneForUser(vehicleId, userId);
  }

  /**
   * Désassigne l'arme d'une Tourelle (état assigné → orphelin).
   *
   * Met `weaponNomInterne` à `null` sans supprimer la Tourelle elle-même. Autorisé
   * même sur une Tourelle `estDefaut` (la Tourelle intégrée ne peut pas être RETIRÉE,
   * mais l'arme qu'elle couvre peut toujours être changée ou retirée par le joueur).
   *
   * Contrairement à `removeImprovement`, aucune vérification `estDefaut` ici : seul
   * le RETRAIT de la Tourelle est interdit pour les améliorations par défaut — pas
   * la modification de son arme.
   */
  async unassignWeaponFromTourelle(
    vehicleId: number,
    improvementId: number,
    userId: number,
  ): Promise<Vehicle> {
    const vehicle = await this.findOneForUser(vehicleId, userId);

    const improvement = vehicle.improvements.find((i) => i.id === improvementId);
    if (!improvement) {
      throw new NotFoundException(
        `Amélioration #${improvementId} introuvable sur le véhicule #${vehicleId}`,
      );
    }
    if (improvement.nomInterne !== 'tourelle') {
      throw new BadRequestException("Cette amélioration n'est pas une Tourelle");
    }

    improvement.weaponNomInterne = null;
    await this.improvementRepo.save(improvement);
    return this.findOneForUser(vehicleId, userId);
  }

  /**
   * Supprime le véhicule — et, par cascade TypeORM (`onDelete: 'CASCADE'`, cf.
   * `vehicle.entity.ts`), tout son équipement (`improvements`/`weapons`) en une
   * seule opération SQL : aucun retrait manuel préalable n'est nécessaire.
   *
   * `findOneForUser` vérifie déjà l'appartenance et lève `NotFoundException`
   * sinon — on n'a rien à dupliquer ici, juste à laisser l'exception remonter
   * (même principe que `findAllForTeam`/`create`, qui délèguent de même).
   */
  async remove(id: number, userId: number): Promise<void> {
    const vehicle = await this.findOneForUser(id, userId);
    await this.vehicleRepo.remove(vehicle);
  }
}
