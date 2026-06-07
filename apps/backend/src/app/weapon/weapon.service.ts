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
   * dans son état ACTUEL ?" Trois règles, dans l'ordre où elles se découvrent
   * naturellement (la plus simple/la moins coûteuse d'abord — pas de raison de
   * construire une chaîne ou de sommer des emplacements pour une arme que le
   * sponsor n'autorise de toute façon pas) :
   *
   *  1. l'arme appartient au catalogue DU SPONSOR de l'équipe (même principe
   *     que `VehicleService.create` pour le véhicule lui-même) ;
   *  2. l'orientation fournie est COHÉRENTE avec le `type` de l'arme — cf.
   *     `weapon.entity.ts`, note d'en-tête : OBLIGATOIRE hors `équipage`
   *     (montée sur un arc précis), INTERDITE pour `équipage` (portée par un
   *     équipier, 360° automatique — fournir une orientation ici serait une
   *     INCOHÉRENCE de la requête, pas un détail à ignorer silencieusement :
   *     un rejet explicite vaut mieux qu'une donnée acceptée puis tue) ;
   *  3. le pool d'emplacements PARTAGÉ (améliorations + armes déjà montées,
   *     plus cette nouvelle arme) tient dans la capacité du véhicule catalogue
   *     — `improvementSlotsOf`/`weaponSlotsOf`, cf. leur en-tête sur `VehicleService`
   *     pour le raisonnement complet du pool commun.
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

    return this.checkCandidate(vehicle, arme, orientation);
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
  private checkCandidate(vehicle: Vehicle, arme: Arme, orientation?: Orientation): RuleResult {
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

    // Règle 2 — cohérence de l'orientation avec le TYPE d'arme (cf. en-tête de
    // `canAddWeapon` : la nuance est SYMÉTRIQUE — manquante ici, superflue là).
    const estEquipage = arme.type === 'équipage';
    if (!estEquipage && orientation === undefined) {
      return fail(`Une orientation est requise pour monter "${arme.nom}" sur un arc de tir`);
    }
    if (estEquipage && orientation !== undefined) {
      return fail(`"${arme.nom}" est une arme d'équipage : elle ne se monte pas sur un arc de tir précis`);
    }

    // Règle 3 — le pool d'emplacements PARTAGÉ (cf. en-tête de ce fichier et des
    // helpers sur `VehicleService`) : améliorations + armes déjà montées, PLUS
    // cette nouvelle arme, doivent tenir dans la capacité d'ORIGINE du véhicule
    // (le catalogue, jamais `stats` — rien dans Gaslands n'augmente cette capacité).
    const catalogVehicule = this.catalogService.getVehiculeByNomInterne(vehicle.nomInterne);
    if (!catalogVehicule) {
      throw new Error(`Véhicule catalogue inconnu : "${vehicle.nomInterne}" (véhicule #${vehicle.id})`);
    }
    const totalDemande =
      this.vehicleService.improvementSlotsOf(vehicle) + this.vehicleService.weaponSlotsOf(vehicle) + arme.emplacement;
    if (totalDemande > catalogVehicule.emplacements) {
      return fail(`Emplacements insuffisants : ${totalDemande}/${catalogVehicule.emplacements} requis avec "${arme.nom}"`);
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
   * pas "puis-je la monter avec TEL réglage ?". Conséquence assumée : toute arme
   * non-équipage apparaîtra avec `disponible: false` et la raison "Une orientation
   * est requise pour…" tant qu'elle n'a pas été choisie — un message qui dit "il
   * vous manque une information", pas "c'est interdit" (cf. note de son modèle
   * pour la discussion complète sur les limites de `RuleResult` à cet égard).
   */
  async getAvailableWeapons(vehicleId: number, userId: number): Promise<AvailableWeaponDto[]> {
    const vehicle = await this.vehicleService.findOneForUser(vehicleId, userId);

    const sponsor = this.catalogService.getSponsor(vehicle.team.sponsor);
    if (!sponsor) {
      throw new Error(`Sponsor catalogue inconnu : "${vehicle.team.sponsor}" (équipe #${vehicle.teamId})`);
    }

    return sponsor.armes.map((arme): AvailableWeaponDto => {
      // Sans orientation : reproduit fidèlement, pour les armes orientables, le
      // message "il manque une information" plutôt que "c'est interdit" (cf. note ci-dessus).
      const result = this.checkCandidate(vehicle, arme);
      return {
        nom: arme.nom,
        nomInterne: arme.nom_interne,
        prix: arme.prix,
        emplacement: arme.emplacement,
        type: arme.type,
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
