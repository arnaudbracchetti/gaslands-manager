import { NotFoundException } from '@nestjs/common';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { assertParticipant } from './authorization.helpers';
import type { WorkshopStateDto, WorkshopVehicleDto } from '../dto/workshop-state.dto';
import { EquipmentEntityType } from '../domain/enums/equipment-change.enums';
import { ParticipantStatus } from '../domain/enums/campaign.enums';
import type { Game } from '../domain/games/game';
import type { Campaign } from '../domain/campaign';
import type { CampaignParticipant } from '../domain/campaign-participant';

export interface GetWorkshopCommand {
  campaignId: number;
  userId: number;
  /**
   * Consulter l'atelier d'UN AUTRE participant, en lecture seule — réservé aux
   * appelants `VALIDATED` (même règle de visibilité que `Game.journal()`/
   * `CampaignQueryService.getParticipantJournal`). Absent = comportement
   * historique (son propre atelier, aucune contrainte de statut sur l'appelant).
   */
  participantId?: number;
}

/**
 * État campagne de l'équipe consultée (le participant connecté, ou un tiers via
 * `participantId`) après replay complet. Inclut les entités transientes (achats
 * atelier) et les effets accumulés (perte, chocs, séquelles). `resistancePoints`
 * est exclu (D-S4).
 */
export class GetWorkshopUseCase {
  constructor(private readonly replayService: CampaignReplayService) {}

  async execute(cmd: GetWorkshopCommand): Promise<WorkshopStateDto> {
    const campaign = await this.replayService.loadAndReplay(cmd.campaignId);
    const caller = assertParticipant(campaign, cmd.userId);
    const target = this.resolveTarget(campaign, caller, cmd.participantId);
    if (!target.hasTeam) {
      throw new NotFoundException('Campagne introuvable ou accès non autorisé.');
    }

    // Aucun atelier ouvert → purchasedThisSession toujours false (comportement attendu,
    // pas une erreur : le workshop reste consultable même hors atelier actif).
    let atelierGame: Game | null;
    try {
      atelierGame = campaign.findAtelierGame();
    } catch {
      atelierGame = null;
    }

    // Un véhicule vendu (isSold) disparaît entièrement de l'atelier — contrairement à
    // une arme/amélioration/avantage vendu(e), qui reste visible barré(e). Cf. Vehicle.markSold.
    const vehicles: WorkshopVehicleDto[] = target.team.vehicles.filter((v) => !v.isSold).map((v) => ({
      id: v.id,
      nomInterne: v.type.nomInterne,
      nom: v.nom,
      customName: v.customName,
      price: v.type.price,
      isLost: v.isLost,
      chocs: v.chocs,
      resaleRefund: v.resaleRefund,
      chassisResaleRefund: v.chassisResaleRefund,
      purchasedThisSession: atelierGame?.wasPurchasedThisSession(EquipmentEntityType.VEHICLE, v.id) ?? false,
      emplacementsTotal: v.effectiveStats.emplacements,
      sequellas: v.sequellas.map((s) => ({
        id: s.id,
        nomInterne: s.type.nomInterne,
        nom: s.type.nom,
        chocsCost: s.type.chocsCost,
        origine: s.type.origine,
        isSold: s.isSold,
        purchasedThisSession: atelierGame?.wasPurchasedThisSession(EquipmentEntityType.SEQUELLE, s.id) ?? false,
        description: s.type.description,
        regles: s.type.regles,
      })),
      weapons: v.weapons.map((w) => ({
        id: w.id,
        nomInterne: w.type.nomInterne,
        orientation: w.orientation,
        // w.price (getter d'entité), PAS w.type.price (prix catalogue brut) : le premier
        // applique le prix résiduel (ceil(price/2)) une fois l'arme vendue (isSold), le
        // second reste toujours le prix plein — cause du bug (prix affiché jamais réduit,
        // et budget total gonflé côté frontend qui resomme ce même prix erroné).
        price: w.price,
        // Résiduel (0 si estDefaut/isLost/isSold) — mirroir de `imp.slots` ci-dessous.
        // Sans ce champ, l'IHM reconstruisait le slot depuis le catalogue, aveugle à
        // isSold : une arme vendue affichait encore son emplacement plein.
        emplacement: w.slots,
        estDefaut: w.estDefaut,
        isLost: w.isLost,
        isSold: w.isSold,
        purchasedThisSession: atelierGame?.wasPurchasedThisSession(EquipmentEntityType.WEAPON, w.id) ?? false,
        // w.resaleRefund lève DomainException si isSold (déjà crédité) — garde nécessaire,
        // contrairement à w.price déjà consommé plus haut qui ne lève jamais.
        resaleRefund: w.isSold ? 0 : w.resaleRefund,
      })),
      improvements: v.improvements.map((imp) => ({
        id: imp.id,
        nomInterne: imp.type.nomInterne,
        orientation: imp.orientation,
        price: imp.price,
        // FIX : ce champ requis n'était jamais peuplé (bug préexistant, révélé par
        // `tsc --noEmit` — les tests Vitest/SWC ne l'attrapent pas). `imp.slots` reflète
        // déjà estDefaut/isLost/isSold, donc l'IHM n'a besoin d'aucun filtre supplémentaire.
        emplacement: imp.slots,
        estDefaut: imp.estDefaut,
        isLost: imp.isLost,
        isSold: imp.isSold,
        purchasedThisSession: atelierGame?.wasPurchasedThisSession(EquipmentEntityType.IMPROVEMENT, imp.id) ?? false,
        // Même garde que weapons ci-dessus — imp.resaleRefund lève si isSold.
        resaleRefund: imp.isSold ? 0 : imp.resaleRefund,
      })),
      advantages: v.advantages.map((a) => ({
        id: a.id,
        nomInterne: a.type.nomInterne,
        // a.price ne baisse jamais avec isSold (perte totale, cf. Advantage.price) —
        // contrairement à weapons/improvements, pas de prix résiduel à distinguer ici.
        price: a.price,
        isLost: a.isLost,
        isSold: a.isSold,
        purchasedThisSession: atelierGame?.wasPurchasedThisSession(EquipmentEntityType.ADVANTAGE, a.id) ?? false,
        // a.resaleRefund lève si isSold, comme weapons/improvements — toujours 0 sinon
        // (perte totale, cf. Advantage.resaleRefund).
        resaleRefund: a.isSold ? 0 : a.resaleRefund,
      })),
    }));

    return {
      participantId: target.id,
      sponsor: target.team.sponsor,
      wallet: target.wallet,
      championshipPoints: target.championshipPoints,
      vehicles,
    };
  }

  /**
   * Sans `participantId` : c'est son propre atelier — comportement historique,
   * aucune contrainte de statut supplémentaire sur l'appelant. Avec
   * `participantId` : lecture seule de l'atelier d'un tiers, réservée aux
   * appelants `VALIDATED` — même politique de visibilité que
   * `CampaignQueryService.getParticipantJournal`/`assertVisibleParticipant`,
   * mais réalisée directement sur l'agrégat déjà chargé (pas de requête SQL
   * supplémentaire). `NotFoundException` dans les deux cas de refus — jamais de
   * fuite d'existence.
   */
  private resolveTarget(campaign: Campaign, caller: CampaignParticipant, participantId?: number): CampaignParticipant {
    if (participantId === undefined) return caller;

    if (caller.status !== ParticipantStatus.VALIDATED) {
      throw new NotFoundException('Campagne introuvable ou accès non autorisé.');
    }
    const target = campaign.participants.find((p) => p.id === participantId);
    if (!target) {
      throw new NotFoundException('Participant introuvable.');
    }
    return target;
  }
}
