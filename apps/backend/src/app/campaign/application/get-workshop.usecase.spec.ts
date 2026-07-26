import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { GetWorkshopUseCase } from './get-workshop.usecase';
import type { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { Campaign } from '../domain/campaign';
import { CampaignParticipant } from '../domain/campaign-participant';
import { CampaignState, ParticipantStatus } from '../domain/enums/campaign.enums';
import { makeTestParticipant, makeTestParticipantWithAdvantage, makeVehicleType } from '../domain/test-helpers';
import { Team } from '../../team/domain/team';
import { Vehicle } from '../../team/domain/vehicle';
import { Weapon } from '../../team/domain/weapon';
import { Improvement } from '../../team/domain/improvement';
import { WeaponType } from '../../team/domain/value-objects/weapon-type';
import { ImprovementType } from '../../team/domain/value-objects/improvement-type';

/**
 * Régression : `weapons[].price` doit refléter le prix RÉSIDUEL une fois l'arme
 * vendue (isSold), pas le prix catalogue brut. Bug réel observé : l'IHM affichait
 * toujours le prix plein sur une arme barrée "Vendue", et le budget total recalculé
 * côté frontend (`buildVehicleSummary`, qui ressomme `weapon.prix`) se retrouvait
 * gonflé de la différence entre prix plein et prix résiduel.
 */
function makeFixture() {
  const { participant, weapon } = makeTestParticipant(1); // weapon.type.price = 5 (makeWeaponType())
  const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [participant], []);
  const replayService: CampaignReplayService = {
    loadAndReplay: vi.fn().mockResolvedValue(campaign),
  } as unknown as CampaignReplayService;
  const useCase = new GetWorkshopUseCase(replayService);
  return { useCase, weapon };
}

describe('GetWorkshopUseCase', () => {
  it('expose le prix catalogue plein et l\'emplacement catalogue tant que l\'arme n\'est pas vendue', async () => {
    const { useCase } = makeFixture();
    const dto = await useCase.execute({ campaignId: 1, userId: 42 });

    expect(dto.vehicles[0].weapons[0].price).toBe(5);
    expect(dto.vehicles[0].weapons[0].emplacement).toBe(1); // slot catalogue (makeWeaponType)
    expect(dto.vehicles[0].weapons[0].isSold).toBe(false);
  });

  it('expose le prix résiduel (ceil(prix/2)) ET l\'emplacement libéré (0) une fois l\'arme vendue', async () => {
    const { useCase, weapon } = makeFixture();
    weapon.markSold();

    const dto = await useCase.execute({ campaignId: 1, userId: 42 });

    const weaponDto = dto.vehicles[0].weapons[0];
    expect(weaponDto.isSold).toBe(true);
    expect(weaponDto.price).toBe(3); // ceil(5/2), pas 5 (prix catalogue brut)
    expect(weaponDto.emplacement).toBe(0); // Weapon.slots ⇒ 0 quand vendue (emplacement libéré)
  });

  it('expose l\'orientation \'tourelle\' sur les armes (coût ×3 déjà appliqué par price)', async () => {
    const bfgType = WeaponType.from({
      nom: 'BFG', nom_interne: 'bfg', type: 'avancée', prix: 20, emplacement: 2,
      description: '', regles: '', sponsors_autorises: [], montable_tourelle: true,
      necessite_orientation: true,
    });
    const weapon = new Weapon(1, bfgType, 'tourelle', false);
    const vehicle = new Vehicle(1, 1, makeVehicleType(), [weapon], []);
    const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [vehicle]);
    const participant = new CampaignParticipant(1, 42, 1, false);
    participant.attachTeam(team);
    const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [participant], []);
    const replayService: CampaignReplayService = {
      loadAndReplay: vi.fn().mockResolvedValue(campaign),
    } as unknown as CampaignReplayService;
    const useCase = new GetWorkshopUseCase(replayService);

    const dto = await useCase.execute({ campaignId: 1, userId: 42 });

    expect(dto.vehicles[0].weapons[0].orientation).toBe('tourelle');
    expect(dto.vehicles[0].weapons[0].price).toBe(60); // 3 × 20
  });

  it('expose les avantages du véhicule, prix catalogue plein tant qu\'il n\'est pas vendu', async () => {
    const { participant, advantage } = makeTestParticipantWithAdvantage();
    const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [participant], []);
    const replayService: CampaignReplayService = {
      loadAndReplay: vi.fn().mockResolvedValue(campaign),
    } as unknown as CampaignReplayService;
    const useCase = new GetWorkshopUseCase(replayService);

    const dto = await useCase.execute({ campaignId: 1, userId: 42 });

    expect(dto.vehicles[0].advantages).toHaveLength(1);
    expect(dto.vehicles[0].advantages[0].nomInterne).toBe(advantage.type.nomInterne);
    expect(dto.vehicles[0].advantages[0].price).toBe(2);
    expect(dto.vehicles[0].advantages[0].isSold).toBe(false);
  });

  it('un avantage vendu garde son prix PLEIN (perte totale) — contrairement à une arme (prix résiduel)', async () => {
    const { participant, advantage } = makeTestParticipantWithAdvantage();
    advantage.markSold();
    const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [participant], []);
    const replayService: CampaignReplayService = {
      loadAndReplay: vi.fn().mockResolvedValue(campaign),
    } as unknown as CampaignReplayService;
    const useCase = new GetWorkshopUseCase(replayService);

    const dto = await useCase.execute({ campaignId: 1, userId: 42 });

    expect(dto.vehicles[0].advantages[0].isSold).toBe(true);
    expect(dto.vehicles[0].advantages[0].price).toBe(2); // PAS ceil(2/2)=1 : jamais réduit
  });

  it('expose resaleRefund (règle par élément) et purchasedThisSession=false pour un véhicule pré-existant', async () => {
    const { useCase } = makeFixture(); // véhicule 12 + arme 5 + amélioration 4 (makeTestParticipant)

    const dto = await useCase.execute({ campaignId: 1, userId: 42 });

    // floor(12/2) + floor(5/2) + floor(4/2) = 6 + 2 + 2 = 10.
    expect(dto.vehicles[0].resaleRefund).toBe(10);
    expect(dto.vehicles[0].purchasedThisSession).toBe(false);
  });

  it('expose chassisResaleRefund (véhicule) et resaleRefund par ligne (arme/amélioration)', async () => {
    const { useCase } = makeFixture(); // véhicule 12 + arme 5 + amélioration 4

    const dto = await useCase.execute({ campaignId: 1, userId: 42 });

    expect(dto.vehicles[0].chassisResaleRefund).toBe(6); // floor(12/2)
    expect(dto.vehicles[0].weapons[0].resaleRefund).toBe(2); // floor(5/2)
    expect(dto.vehicles[0].improvements[0].resaleRefund).toBe(2); // floor(4/2)
  });

  it('expose resaleRefund=0 sur une arme/amélioration déjà vendue (déjà créditée à sa propre vente)', async () => {
    const { useCase, weapon } = makeFixture();
    weapon.markSold();

    const dto = await useCase.execute({ campaignId: 1, userId: 42 });

    expect(dto.vehicles[0].weapons[0].resaleRefund).toBe(0);
  });

  it('expose resaleRefund=0 sur un avantage (perte totale)', async () => {
    const { participant } = makeTestParticipantWithAdvantage();
    const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [participant], []);
    const replayService: CampaignReplayService = {
      loadAndReplay: vi.fn().mockResolvedValue(campaign),
    } as unknown as CampaignReplayService;
    const useCase = new GetWorkshopUseCase(replayService);

    const dto = await useCase.execute({ campaignId: 1, userId: 42 });

    expect(dto.vehicles[0].advantages[0].resaleRefund).toBe(0);
  });

  /**
   * Régression : un véhicule vendu (isSold) doit disparaître entièrement de la liste
   * exposée — contrairement à une arme/amélioration/avantage vendu(e), qui reste
   * visible barré(e) — ET la cagnotte doit refléter le remboursement PARTIEL
   * (règle par élément), pas la disparition totale du coût du véhicule (bug corrigé :
   * Team.removeCampaignVehicle() était appelé à la revente, effaçant tout le coût du
   * véhicule au lieu du seul montant remboursé).
   */
  it('un véhicule vendu est absent de la liste exposée, et la cagnotte reflète le remboursement partiel', async () => {
    const { participant, vehicle, weapon, improvement } = makeTestParticipant(); // 50 - (12+5+4) = 29
    vehicle.markSold(); // cascade : arme + amélioration marquées vendues aussi

    const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [participant], []);
    const replayService: CampaignReplayService = {
      loadAndReplay: vi.fn().mockResolvedValue(campaign),
    } as unknown as CampaignReplayService;
    const useCase = new GetWorkshopUseCase(replayService);

    const dto = await useCase.execute({ campaignId: 1, userId: 42 });

    expect(dto.vehicles).toHaveLength(0);
    // 29 + floor(12/2) + floor(5/2) + floor(4/2) = 29 + 10 = 39 (jamais 50 : le bug
    // corrigé créditait la totalité du coût du véhicule, pas le remboursement partiel).
    expect(dto.wallet).toBe(39);
    expect(weapon.isSold).toBe(true);
    expect(improvement.isSold).toBe(true);
  });

  /**
   * Régression IHM : `emplacementsTotal` doit refléter la capacité EFFECTIVE du
   * véhicule (`Vehicle.effectiveStats.emplacements`), pas seulement la fiche
   * catalogue brute — sans amélioration de capacité montée, les deux coïncident
   * (4, cf. `makeVehicleType()`).
   */
  it('expose emplacementsTotal = capacité catalogue de base sans amélioration de capacité', async () => {
    const { useCase } = makeFixture();

    const dto = await useCase.execute({ campaignId: 1, userId: 42 });

    expect(dto.vehicles[0].emplacementsTotal).toBe(4);
  });

  it('expose emplacementsTotal augmenté du bonus d\'une Remorque Moyenne montée (+1)', async () => {
    const remorqueMoyenneType = ImprovementType.from({
      nom: 'Remorque Moyenne', nom_interne: 'remorque_moyenne',
      prix: 8, emplacement: 0, description: '', regles: '', sponsors_autorises: [],
      comportement: 'remorque_moyenne', necessite_orientation: false,
    });
    const remorque = new Improvement(20, remorqueMoyenneType, null, false);
    const vehicle = new Vehicle(1, 1, makeVehicleType(), [], [remorque]);
    const team = new Team(1, 42, 'Les Furieux', 'Rutherford', 50, null, [vehicle]);
    const participant = new CampaignParticipant(1, 42, 1, false);
    participant.attachTeam(team);
    const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [participant], []);
    const replayService: CampaignReplayService = {
      loadAndReplay: vi.fn().mockResolvedValue(campaign),
    } as unknown as CampaignReplayService;
    const useCase = new GetWorkshopUseCase(replayService);

    const dto = await useCase.execute({ campaignId: 1, userId: 42 });

    // 4 (base, makeVehicleType) + 1 (bonus Remorque Moyenne) = 5.
    expect(dto.vehicles[0].emplacementsTotal).toBe(5);
  });
});

/**
 * Consultation en lecture seule de l'atelier d'UN AUTRE participant
 * (`participantId` dans la commande) — cf. `docs/spec/CAMPAIGN.md`, §Atelier et
 * épaves. Même politique de visibilité que `Game.journal()`/
 * `CampaignQueryService.getParticipantJournal` : appelant VALIDATED requis,
 * cible résolue par id dans la campagne, `NotFoundException` (jamais 403) dans
 * les deux cas de refus.
 */
describe('GetWorkshopUseCase — consultation de l\'atelier d\'un tiers (participantId)', () => {
  it('retourne l\'atelier du participant CIBLÉ (pas celui de l\'appelant) quand l\'appelant est VALIDATED', async () => {
    const { participant: target } = makeTestParticipant(1); // userId 42, VALIDATED, wallet 29
    target.addResistance(9); // 3 points de sabotage — doivent rester cachés à un tiers
    const caller = new CampaignParticipant(2, 99, null, false, ParticipantStatus.VALIDATED);
    const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [target, caller], []);
    const replayService: CampaignReplayService = {
      loadAndReplay: vi.fn().mockResolvedValue(campaign),
    } as unknown as CampaignReplayService;
    const useCase = new GetWorkshopUseCase(replayService);

    const dto = await useCase.execute({ campaignId: 1, userId: 99, participantId: 1 });

    expect(dto.participantId).toBe(1);
    expect(dto.sponsor).toBe('Rutherford');
    expect(dto.wallet).toBe(29);
    // Secret vis-à-vis des autres joueurs (D-S4) : jamais exposé via participantId.
    expect(dto.sabotagePoints).toBeNull();
  });

  it('self-view (participantId absent) reste inchangée : aucune contrainte de statut sur l\'appelant', async () => {
    const { participant } = makeTestParticipant(1);
    participant.addResistance(9); // 3 points de sabotage — exposés à son propriétaire
    const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [participant], []);
    const replayService: CampaignReplayService = {
      loadAndReplay: vi.fn().mockResolvedValue(campaign),
    } as unknown as CampaignReplayService;
    const useCase = new GetWorkshopUseCase(replayService);

    const dto = await useCase.execute({ campaignId: 1, userId: 42 });

    expect(dto.participantId).toBe(1);
    expect(dto.sabotagePoints).toBe(3);
  });

  it('rejette (NotFoundException) un appelant non-VALIDATED consultant un tiers', async () => {
    const { participant: target } = makeTestParticipant(1);
    const caller = new CampaignParticipant(2, 99, null, false, ParticipantStatus.PENDING);
    const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [target, caller], []);
    const replayService: CampaignReplayService = {
      loadAndReplay: vi.fn().mockResolvedValue(campaign),
    } as unknown as CampaignReplayService;
    const useCase = new GetWorkshopUseCase(replayService);

    await expect(useCase.execute({ campaignId: 1, userId: 99, participantId: 1 })).rejects.toThrow(NotFoundException);
  });

  it('rejette (NotFoundException) un participantId inexistant dans la campagne', async () => {
    const { participant: caller } = makeTestParticipant(1);
    const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [caller], []);
    const replayService: CampaignReplayService = {
      loadAndReplay: vi.fn().mockResolvedValue(campaign),
    } as unknown as CampaignReplayService;
    const useCase = new GetWorkshopUseCase(replayService);

    await expect(useCase.execute({ campaignId: 1, userId: 42, participantId: 999 })).rejects.toThrow(NotFoundException);
  });
});
