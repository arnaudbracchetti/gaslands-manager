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

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle, VehicleImprovement } from './vehicle.entity';
import { CatalogService } from '../catalog/catalog.service';
import { TeamService } from '../team/team.service';
import { VehicleBuildFactory } from './vehicle-build.factory';
import { ImprovementDecoratorFactory } from './improvement-decorator.factory';
import type { Amelioration } from '../catalog/catalog.interfaces';
import type { AvailableImprovementDto } from './dto/available-improvement.dto';
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
   * `teamService.findOneForUser` fait tout le travail de vérification : si
   * l'équipe n'existe pas OU n'appartient pas à `userId`, elle lève déjà
   * `NotFoundException` — on n'a rien à dupliquer ici, juste à laisser
   * l'exception remonter telle quelle (même équipe introuvable pour le
   * controller équipe que pour celui-ci : c'est voulu, cf. `findOneForUser`).
   *
   * `relations: { improvements: true, weapons: true }` : la liste sert au
   * frontend à rafraîchir son état (recompter les emplacements utilisés,
   * afficher un récapitulatif...) — autant éviter le coût d'un second aller-
   * retour par véhicule (même raisonnement que `findOneForUser`).
   */
  async findAllForTeam(teamId: number, userId: number): Promise<Vehicle[]> {
    await this.teamService.findOneForUser(teamId, userId);
    return this.vehicleRepo.find({
      where: { teamId },
      relations: { improvements: true, weapons: true },
    });
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
    return this.vehicleRepo.save(vehicle);
  }

  /**
   * Charge un véhicule par son id, uniquement s'il appartient (via son équipe)
   * à l'utilisateur connecté.
   *
   * `where: { id, team: { userId } }` : TypeORM traduit la condition imbriquée
   * sur la relation en jointure SQL — comme `TeamService.findOneForUser` filtre
   * directement sur `userId`, sauf que `Vehicle` ne porte pas cette colonne : il
   * faut remonter par `team`. `relations: { team: true, improvements: true,
   * weapons: true }` charge l'équipe (le filtre ci-dessus la JOINT de toute façon
   * — autant peupler `vehicle.team.sponsor`, nécessaire à `getAvailableImprovements`/
   * `getAvailableWeapons` pour filtrer le catalogue), les améliorations installées
   * (nécessaires à `getBuild` pour reconstituer la chaîne) ET les armes montées
   * (nécessaires à `weaponSlotsOf` ci-dessous, et à `WeaponService` — toutes deux
   * lisent `vehicle.weapons`, qui serait sinon `undefined`) — la quasi-totalité des
   * usages de cette méthode a besoin d'au moins une de ces relations, autant
   * éviter des requêtes supplémentaires.
   *
   * Lève `NotFoundException` (HTTP 404) si introuvable OU si l'appartenance
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
    return vehicle;
  }

  // ── Emplacements partagés (armes ET améliorations) ──────────────────────────

  /**
   * Combien d'emplacements consomment les améliorations RÉELLEMENT posées
   * (persistées) sur ce véhicule.
   *
   * Pourquoi ce helper existe-t-il à côté de `VehicleBuild.totalEmplacements()` ?
   * Ce dernier répond à EXACTEMENT la même question (cf. `vehicle-build.ts`) —
   * mais reconstruire toute la chaîne `VehicleBuild` juste pour lire un total
   * d'emplacements serait un détour coûteux et conceptuellement déplacé : ce
   * helper sert `checkCandidate` (qui, lui, construit DÉJÀ une chaîne — donc
   * pourrait l'utiliser directement) ET `WeaponService` (qui n'a STRUCTURELLEMENT
   * aucune chaîne à disposition — les armes ne sont pas des décorateurs, cf.
   * note de conception du plan). Plutôt que de dupliquer ce calcul ou d'exposer
   * la machinerie `VehicleBuild` à `WeaponService` (qui n'en a pas besoin pour le
   * reste), un seul helper PUBLIC et SANS ÉTAT — une simple somme sur les lignes
   * persistées — sert les deux appelants de façon identique et triviale à tester.
   *
   * `vehicle.improvements` doit avoir été chargé au préalable (cf. `findOneForUser`).
   */
  improvementSlotsOf(vehicle: Vehicle): number {
    return vehicle.improvements.reduce((total, improvement) => {
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
   * Combien d'emplacements consomment les armes RÉELLEMENT montées (persistées)
   * sur ce véhicule — miroir exact de `improvementSlotsOf` ci-dessus, même
   * raisonnement (cf. son commentaire), pour le pool partagé `Vehicule.emplacements`.
   *
   * `vehicle.weapons` doit avoir été chargé au préalable (cf. `findOneForUser`).
   */
  weaponSlotsOf(vehicle: Vehicle): number {
    return vehicle.weapons.reduce((total, weapon) => {
      const arme = this.catalogService.getArmeByNomInterne(weapon.nomInterne);
      if (!arme) {
        throw new Error(
          `Arme catalogue inconnue : "${weapon.nomInterne}" (véhicule #${vehicle.id})`,
        );
      }
      return total + arme.emplacement;
    }, 0);
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

    const installed: InstalledImprovement[] = vehicle.improvements.map(
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
   * Le cœur de la vérification à blanc — "envelopper PUIS valider" — extrait en
   * méthode synchrone et privée pour pouvoir être appelée PLUSIEURS FOIS sur LA
   * MÊME chaîne déjà chargée, sans recharger le véhicule à chaque fois.
   *
   * Pourquoi ce découpage ? `canAddImprovement` ci-dessus répond à "puis-je ajouter
   * CETTE amélioration précise ?" (1 vérification ⇒ 1 chargement, le coût est
   * négligeable). Mais `getAvailableImprovements` ci-dessous pose la MÊME question
   * pour CHAQUE amélioration du catalogue filtré par sponsor — recharger le véhicule
   * à chaque itération multiplierait les allers-retours SQL par la taille du
   * catalogue, pour un résultat strictement identique (la chaîne réelle ne bouge
   * pas entre deux vérifications consécutives). En séparant "construire la chaîne
   * actuelle" (coûteux, fait UNE fois) de "tester un candidat dessus" (pur, en
   * mémoire, répétable à volonté), chaque appelant ne paie que ce dont il a besoin.
   *
   * ⚠️ `vehicle` est requis EN PLUS de `currentBuild` : la chaîne `VehicleBuild`
   * ne connaît QUE les améliorations (`totalEmplacements()`, cf. son en-tête —
   * périmètre volontairement restreint, pour ne pas mélanger deux préoccupations
   * dans le Décorateur). Or `Vehicule.emplacements` est un pool PARTAGÉ entre
   * améliorations ET armes (cf. plan, "Décision de conception tranchée") : valider
   * "cette chaîne d'améliorations est cohérente" ne suffit pas — il faut AUSSI
   * vérifier que la chaîne, une fois étendue avec le candidat, tient encore dans
   * ce pool COMMUN aux armes déjà montées. D'où la vérification complémentaire
   * ci-dessous, délibérément placée APRÈS `validate()` — elle ne s'exécute que si
   * la chaîne est par ailleurs cohérente, évitant de masquer une vraie erreur de
   * règle métier derrière un message générique de dépassement d'emplacements.
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
}
