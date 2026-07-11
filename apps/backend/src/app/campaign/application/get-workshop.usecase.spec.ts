import { describe, it, expect, vi } from 'vitest';
import { GetWorkshopUseCase } from './get-workshop.usecase';
import type { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import { Campaign } from '../domain/campaign';
import { CampaignState } from '../domain/enums/campaign.enums';
import { makeTestParticipant } from '../domain/test-helpers';

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
  it('expose le prix catalogue plein tant que l\'arme n\'est pas vendue', async () => {
    const { useCase } = makeFixture();
    const dto = await useCase.execute({ campaignId: 1, userId: 42 });

    expect(dto.vehicles[0].weapons[0].price).toBe(5);
    expect(dto.vehicles[0].weapons[0].isSold).toBe(false);
  });

  it('expose le prix résiduel (ceil(prix/2)), PAS le prix catalogue, une fois l\'arme vendue', async () => {
    const { useCase, weapon } = makeFixture();
    weapon.markSold();

    const dto = await useCase.execute({ campaignId: 1, userId: 42 });

    const weaponDto = dto.vehicles[0].weapons[0];
    expect(weaponDto.isSold).toBe(true);
    expect(weaponDto.price).toBe(3); // ceil(5/2), pas 5 (prix catalogue brut)
  });
});
