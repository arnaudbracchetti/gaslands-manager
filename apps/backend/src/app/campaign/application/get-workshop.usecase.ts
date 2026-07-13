import { NotFoundException } from '@nestjs/common';
import { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { assertParticipant } from './authorization.helpers';
import type { WorkshopStateDto, WorkshopVehicleDto } from '../dto/workshop-state.dto';
import { EquipmentEntityType } from '../domain/enums/equipment-change.enums';
import type { Game } from '../domain/games/game';

export interface GetWorkshopCommand {
  campaignId: number;
  userId: number;
}

/**
 * État campagne de l'équipe du participant connecté après replay complet.
 * Inclut les entités transientes (achats atelier) et les effets accumulés
 * (perte, chocs, séquelles). `resistancePoints` est exclu (D-S4).
 */
export class GetWorkshopUseCase {
  constructor(private readonly replayService: CampaignReplayService) {}

  async execute(cmd: GetWorkshopCommand): Promise<WorkshopStateDto> {
    const campaign = await this.replayService.loadAndReplay(cmd.campaignId);
    const me = assertParticipant(campaign, cmd.userId);
    if (!me.hasTeam) {
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
    const vehicles: WorkshopVehicleDto[] = me.team.vehicles.filter((v) => !v.isSold).map((v) => ({
      id: v.id,
      nomInterne: v.type.nomInterne,
      price: v.type.price,
      isLost: v.isLost,
      chocs: v.chocs,
      resaleRefund: v.resaleRefund,
      purchasedThisSession: atelierGame?.wasPurchasedThisSession(EquipmentEntityType.VEHICLE, v.id) ?? false,
      sequellas: v.sequellas.map((s) => ({
        id: s.id,
        nomInterne: s.type.nomInterne,
        nom: s.type.nom,
        chocsCost: s.type.chocsCost,
        origine: s.type.origine,
        isSold: s.isSold,
        purchasedThisSession: atelierGame?.wasPurchasedThisSession(EquipmentEntityType.SEQUELLE, s.id) ?? false,
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
        estDefaut: w.estDefaut,
        isLost: w.isLost,
        isSold: w.isSold,
        purchasedThisSession: atelierGame?.wasPurchasedThisSession(EquipmentEntityType.WEAPON, w.id) ?? false,
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
      })),
      advantages: v.advantages.map((a) => ({
        id: a.id,
        nomInterne: a.type.nomInterne,
        // a.price ne baisse jamais avec isSold (perte totale, cf. Advantage.price) —
        // contrairement à weapons/improvements, pas de prix résiduel à distinguer ici.
        price: a.price,
        isSold: a.isSold,
        purchasedThisSession: atelierGame?.wasPurchasedThisSession(EquipmentEntityType.ADVANTAGE, a.id) ?? false,
      })),
    }));

    return {
      participantId: me.id,
      sponsor: me.team.sponsor,
      wallet: me.wallet,
      championshipPoints: me.championshipPoints,
      vehicles,
    };
  }
}
