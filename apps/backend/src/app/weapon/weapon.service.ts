/**
 * WeaponService — orchestration métier du module Weapon.
 *
 * Mirroir du "bloc améliorations" de `VehicleService` (cf. son en-tête et ses
 * sections "Vérification et persistance des améliorations") — on retrouve la
 * même mécanique "envelopper PUIS valider PUIS persister" et la même posture
 * de sécurité (`NotFoundException`, jamais `403`). Une différence structurelle
 * majeure justifie pourtant un service à part plutôt qu'une simple extension :
 *
 * Les améliorations MODIFIENT le profil du véhicule (Chenilles change la
 * vitesse, Blindage la carrosserie...) — d'où le Pattern Decorator (`VehicleBuild`),
 * indispensable pour empiler des effets cumulatifs et interroger "le véhicule
 * tel qu'il est maintenant". Les armes, elles, ne TOUCHENT JAMAIS aux stats
 * (cf. SPECIFICATION.md §5, doc de `Weapon` ; aucune n'a de `comportement` au
 * sens du Décorateur) : une simple liste de règles indépendantes — sponsor,
 * orientation, emplacements — suffit, sans aucune notion de chaîne ni
 * d'empilement. Bâtir une seconde hiérarchie de décorateurs pour des objets qui
 * ne décorent rien serait un détour conceptuel, pas une élégance.
 *
 * D'où la dépendance vers `VehicleService` (injecté) plutôt que vers les
 * `Repository` bas niveau de `Vehicle` : `findOneForUser` (sécurité + chargement
 * des relations `improvements`/`weapons`) et les helpers `improvementSlotsOf`/
 * `weaponSlotsOf` (pool d'emplacements PARTAGÉ, cf. leur en-tête) sont déjà là,
 * testés et partagés — les dupliquer ici recréerait exactement le risque de
 * divergence que ces helpers existent pour éliminer.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Weapon } from './weapon.entity';
import { Vehicle } from '../vehicle/vehicle.entity';
import { CatalogService } from '../catalog/catalog.service';
import { VehicleService } from '../vehicle/vehicle.service';
import type { Arme } from '../catalog/catalog.interfaces';
import type { AvailableWeaponDto } from './dto/available-weapon.dto';
import { fail, ok, type Orientation, type RuleResult } from '../vehicle/vehicle-build';

@Injectable()
export class WeaponService {
  constructor(
    @InjectRepository(Weapon)
    private readonly weaponRepo: Repository<Weapon>,
    private readonly vehicleService: VehicleService,
    private readonly catalogService: CatalogService,
  ) {}

  // ── Vérification et persistance des armes ──────────────────────────────────

  /**
   * Vérification à blanc — "puis-je monter CETTE arme précise sur CE véhicule,
   * dans son état ACTUEL ?" Cinq règles, dans un ordre DÉLIBÉRÉ qui garantit
   * que la raison renvoyée reflète le VRAI blocage et non un artefact du flux
   * de contrôle :
   *
   *  1. l'arme appartient au catalogue DU SPONSOR de l'équipe (vérification la
   *     plus légère — pas de raison de calculer des emplacements pour une arme
   *     que le sponsor n'autorise de toute façon pas) ;
   *  2. le budget RESTANT de l'équipe (tous véhicules confondus, cf.
   *     `VehicleService.getRemainingBudget`) couvre le prix de cette arme —
   *     vérifiée tôt : une arme inabordable n'a pas à être évaluée plus
   *     finement (emplacements, orientation) ;
   *  3. l'orientation est INCOHÉRENTE pour une arme d'équipage — INTERDITE par
   *     définition (portée par un équipier, 360° automatique ; cf. `weapon.entity.ts`,
   *     note d'en-tête). Ce cas ne peut pas se produire lors du listing
   *     (`getAvailableWeapons` n'a pas d'orientation), mais au moment de l'ajout
   *     c'est une incohérence de la requête elle-même, pas un état du véhicule :
   *     un rejet explicite vaut mieux qu'une donnée acceptée puis perdue ;
   *  4. le pool d'emplacements PARTAGÉ (améliorations + armes déjà montées, plus
   *     cette nouvelle arme) tient dans la capacité du véhicule catalogue —
   *     `improvementSlotsOf`/`weaponSlotsOf`, cf. leur en-tête sur `VehicleService` ;
   *  5. l'orientation est MANQUANTE pour une arme hors-équipage — vérifiée EN
   *     DERNIER car c'est une "information encore à fournir", pas un refus : lors
   *     du listing, cette règle signale "choisissez une orientation avant d'ajouter",
   *     et seulement si les emplacements sont disponibles ET le budget suffisant.
   *     Placer cette vérification AVANT le budget/les emplacements masquerait le
   *     vrai blocage : une arme refusée pour manque de place ou de budget recevrait
   *     le message "orientation requise" au lieu du vrai motif, trompant l'UI
   *     (cf. correctif d'origine sur les emplacements).
   *
   * Retourne un `RuleResult` (jamais un booléen) — `reason` alimente aussi bien
   * `BadRequestException` que l'UI (`getAvailableWeapons` ci-dessous), exactement
   * comme `VehicleService.canAddImprovement` (même contrat, même raison d'être).
   */
  async canAddWeapon(
    vehicleId: number,
    userId: number,
    nomInterne: string,
    orientation?: Orientation,
  ): Promise<RuleResult> {
    const vehicle = await this.vehicleService.findOneForUser(vehicleId, userId);

    const arme = this.catalogService.getArmeByNomInterne(nomInterne);
    if (!arme) {
      return fail(`Arme inconnue du catalogue : "${nomInterne}"`);
    }

    const remainingBudget = await this.vehicleService.getRemainingBudget(vehicle, userId);
    return this.checkCandidate(vehicle, arme, remainingBudget, orientation);
  }

  /**
   * Le cœur de la vérification à blanc, extrait en méthode PRIVÉE et SYNCHRONE
   * pour pouvoir être appelée plusieurs fois sur LE MÊME véhicule déjà chargé —
   * mirroir exact de `VehicleService.checkCandidate` (cf. son en-tête pour le
   * raisonnement complet sur ce découpage : `canAddWeapon` répond "puis-je monter
   * CETTE arme ?", `getAvailableWeapons` pose la même question pour CHAQUE arme
   * du catalogue filtré — recharger le véhicule à chaque itération multiplierait
   * les allers-retours SQL pour un résultat strictement identique).
   *
   * Contrairement à son homologue, pas de chaîne `VehicleBuild` à construire ni
   * à valider : les armes ne MODIFIENT rien (cf. en-tête de ce fichier) — les
   * trois règles se lisent directement sur le catalogue et les lignes persistées.
   */
  private checkCandidate(vehicle: Vehicle, arme: Arme, remainingBudget: number, orientation?: Orientation): RuleResult {
    const sponsor = this.catalogService.getSponsor(vehicle.team.sponsor);
    if (!sponsor) {
      // Incohérence de données (sponsor enregistré inconnu du catalogue) — pas
      // une erreur utilisateur, même posture que `VehicleService.create`/`getBuild`.
      throw new Error(`Sponsor catalogue inconnu : "${vehicle.team.sponsor}" (équipe #${vehicle.teamId})`);
    }

    // Règle 1 — l'arme fait-elle partie du catalogue accessible à ce sponsor ?
    const autorisee = sponsor.armes.some((a) => a.nom_interne === arme.nom_interne);
    if (!autorisee) {
      return fail(`L'arme "${arme.nom}" n'est pas autorisée pour le sponsor "${sponsor.nom}"`);
    }

    // Règle 2 — le budget RESTANT de l'équipe (tous véhicules confondus) doit
    // couvrir le prix de cette arme. Vérifiée tôt, AVANT l'orientation manquante :
    // une arme inabordable est un refus DÉFINITIF, qui ne doit pas être masqué
    // derrière "choisissez une orientation" (cf. en-tête de `canAddWeapon`).
    if (arme.prix > remainingBudget) {
      return fail(`Budget de l'équipe insuffisant : ${arme.prix} 🛢️ requis, ${remainingBudget} 🛢️ restants`);
    }

    // Règle 3 — orientation INTERDITE pour une arme d'équipage (portée par un
    // équipier, 360° automatique ; cf. `weapon.entity.ts`, note d'en-tête et
    // en-tête de `canAddWeapon`). Vérifiée AVANT les emplacements : c'est une
    // incohérence de la requête elle-même, indépendante de l'état du véhicule.
    const estEquipage = arme.type === 'équipage';
    if (estEquipage && orientation !== undefined) {
      return fail(`"${arme.nom}" est une arme d'équipage : elle ne se monte pas sur un arc de tir précis`);
    }

    // Règle 4 — le pool d'emplacements PARTAGÉ (cf. en-tête de ce fichier et des
    // helpers sur `VehicleService`) : améliorations + armes déjà montées, PLUS
    // cette nouvelle arme, doivent tenir dans la capacité d'ORIGINE du véhicule
    // (le catalogue, jamais `stats` — rien dans Gaslands n'augmente cette capacité).
    // Vérifiée AVANT l'orientation manquante : si le véhicule est plein, c'est
    // le vrai blocage — l'UI doit griser l'arme avec "emplacements insuffisants",
    // pas masquer ce refus derrière "orientation requise" (cf. correctif en-tête).
    const catalogVehicule = this.catalogService.getVehiculeByNomInterne(vehicle.nomInterne);
    if (!catalogVehicule) {
      throw new Error(`Véhicule catalogue inconnu : "${vehicle.nomInterne}" (véhicule #${vehicle.id})`);
    }
    const totalDemande =
      this.vehicleService.improvementSlotsOf(vehicle) + this.vehicleService.weaponSlotsOf(vehicle) + arme.emplacement;
    if (totalDemande > catalogVehicule.emplacements) {
      return fail(`Emplacements insuffisants : ${totalDemande}/${catalogVehicule.emplacements} requis avec "${arme.nom}"`);
    }

    // Règle 5 — orientation MANQUANTE pour une arme hors-équipage (cf. en-tête de
    // `canAddWeapon`). Vérifiée EN DERNIER : c'est une "information encore à fournir",
    // pas un refus définitif. Lors du listing (`getAvailableWeapons`), cette raison
    // indique "choisissez une orientation avant d'ajouter" — le frontend affiche alors
    // le sélecteur d'orientation plutôt que de griser l'arme. Elle ne doit apparaître
    // QUE si l'arme est par ailleurs disponible (budget et emplacements suffisants,
    // sponsor ok).
    if (!estEquipage && orientation === undefined) {
      return fail(`Une orientation est requise pour monter "${arme.nom}" sur un arc de tir`);
    }

    return ok();
  }

  /**
   * Liste, pour le sponsor de l'équipe, chaque arme de son catalogue accompagnée
   * du verdict "puis-je la monter MAINTENANT sur ce véhicule ?" — mirroir exact
   * de `VehicleService.getAvailableImprovements` (même structure, même raisonnement
   * sur la réutilisation du véhicule déjà chargé entre les itérations).
   *
   * ⚠️ Même nuance que son modèle : l'orientation n'est PAS fournie ici — cette
   * liste répond à "cette arme est-elle accessible à ce véhicule, par principe ?",
   * pas "puis-je la monter avec TEL réglage ?". Conséquence : une arme non-équipage
   * dont les emplacements sont disponibles apparaîtra avec `disponible: false` et la
   * raison "Une orientation est requise pour…" — un message qui dit "il vous manque
   * une information", pas "c'est interdit". En revanche, si les emplacements sont
   * insuffisants, la raison sera "Emplacements insuffisants…" — le vrai blocage est
   * signalé, et l'UI peut griser l'arme en conséquence (cf. correctif dans l'en-tête
   * de `checkCandidate` : l'ordre des règles garantit ce comportement).
   */
  async getAvailableWeapons(vehicleId: number, userId: number): Promise<AvailableWeaponDto[]> {
    const vehicle = await this.vehicleService.findOneForUser(vehicleId, userId);

    const sponsor = this.catalogService.getSponsor(vehicle.team.sponsor);
    if (!sponsor) {
      throw new Error(`Sponsor catalogue inconnu : "${vehicle.team.sponsor}" (équipe #${vehicle.teamId})`);
    }

    // Calculé UNE SEULE FOIS — mirroir de `VehicleService.getAvailableImprovements` :
    // le budget restant ne change pas d'une arme à l'autre du catalogue (cf. `checkCandidate`).
    const remainingBudget = await this.vehicleService.getRemainingBudget(vehicle, userId);

    return sponsor.armes.map((arme): AvailableWeaponDto => {
      // Sans orientation : reproduit fidèlement, pour les armes orientables, le
      // message "il manque une information" plutôt que "c'est interdit" (cf. note ci-dessus).
      const result = this.checkCandidate(vehicle, arme, remainingBudget);
      return {
        nom: arme.nom,
        nomInterne: arme.nom_interne,
        prix: arme.prix,
        emplacement: arme.emplacement,
        type: arme.type,
        description: arme.description,
        regles: arme.regles,
        disponible: result.ok,
        raison: result.ok ? undefined : result.reason,
      };
    });
  }

  /**
   * Ajout réel d'une arme — ne persiste QUE si la vérification à blanc ci-dessus
   * est positive (mirroir exact de `VehicleService.addImprovement` : "envelopper
   * PUIS valider PUIS, et seulement alors, persister"). Lève `BadRequestException`
   * sinon, avec la raison fournie par `RuleResult.reason`.
   *
   * Retourne le véhicule rechargé (avec sa nouvelle arme) — `weaponSlotsOf` et
   * tout calcul ultérieur la prendront alors en compte, désormais légitime.
   */
  async addWeapon(vehicleId: number, userId: number, nomInterne: string, orientation?: Orientation): Promise<Vehicle> {
    const result = await this.canAddWeapon(vehicleId, userId, nomInterne, orientation);
    if (!result.ok) {
      throw new BadRequestException(result.reason);
    }

    const weapon = this.weaponRepo.create({
      vehicleId,
      nomInterne,
      orientation: orientation ?? null,
    });
    await this.weaponRepo.save(weapon);

    return this.vehicleService.findOneForUser(vehicleId, userId);
  }

  /**
   * Retire une arme d'un véhicule — réservé au propriétaire de l'équipe.
   *
   * `Weapon` ne porte ni `userId` ni même `teamId` directement (seulement
   * `vehicleId`, cf. `weapon.entity.ts`) : il faut donc remonter TOUTE la
   * chaîne `Weapon → Vehicle → Team → User` pour vérifier l'appartenance —
   * un maillon de plus que `VehicleService.findOneForUser` (`Vehicle → Team
   * → User`), mais EXACTEMENT le même principe : TypeORM traduit la condition
   * imbriquée sur les relations en jointures SQL, et l'absence de résultat
   * (arme inexistante OU appartenant à un autre utilisateur) lève la même
   * `NotFoundException` — les deux cas restent indiscernables pour l'appelant,
   * par construction (cf. en-tête de `VehicleService` : ne jamais révéler
   * l'EXISTENCE d'une ressource qu'on ne possède pas).
   */
  async removeWeapon(weaponId: number, userId: number): Promise<void> {
    const weapon = await this.weaponRepo.findOne({
      where: { id: weaponId, vehicle: { team: { userId } } },
    });
    if (!weapon) {
      throw new NotFoundException(`Arme #${weaponId} introuvable`);
    }
    await this.weaponRepo.remove(weapon);
  }
}
