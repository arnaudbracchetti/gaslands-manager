import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { GetWorkshopAvailableVehiclesUseCase } from './get-workshop-available-vehicles.usecase';
import type { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import type { CatalogService } from '../../catalog/catalog.service';
import { VehicleType } from '../../team/domain/value-objects/vehicle-type';
import { Campaign } from '../domain/campaign';
import { CampaignState } from '../domain/enums/campaign.enums';
import { makeTestParticipant } from '../domain/test-helpers';

const VOITURE = VehicleType.from({
  nom: 'Voiture', nom_interne: 'voiture', poids: 'Moyen',
  carrosserie: 6, manoeuvrabilite: 4, vitesse_max: 6, equipage: 2,
  emplacements: 4, prix: 12, description: '', regles: '', sponsors_autorises: [],
});
const CAMION_LOURD = VehicleType.from({
  nom: 'Camion Lourd', nom_interne: 'camion_lourd', poids: 'Lourd',
  carrosserie: 12, manoeuvrabilite: 2, vitesse_max: 5, equipage: 3,
  emplacements: 6, prix: 30, description: '', regles: '', sponsors_autorises: [],
});

function makeFixture() {
  // makeTestParticipant : équipe Rutherford, cans 50, build à 12 (véhicule seul) →
  // cagnotte (wallet) initiale de 29 (cf. test-helpers.ts, doc de `makeTestParticipant`).
  const { participant } = makeTestParticipant(1);
  const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [participant], []);
  const replayService: CampaignReplayService = {
    loadAndReplay: vi.fn().mockResolvedValue(campaign),
  } as unknown as CampaignReplayService;
  const catalog: CatalogService = {
    getVehicleTypesForSponsor: () => [VOITURE, CAMION_LOURD],
  } as unknown as CatalogService;
  const useCase = new GetWorkshopAvailableVehiclesUseCase(replayService, catalog);
  return { useCase };
}

describe('GetWorkshopAvailableVehiclesUseCase', () => {
  it('marque disponible=true un véhicule dont le prix ne dépasse pas la cagnotte', async () => {
    const { useCase } = makeFixture();

    const dto = await useCase.execute({ campaignId: 1, userId: 42 });

    const voiture = dto.find((v) => v.nomInterne === 'voiture');
    expect(voiture?.disponible).toBe(true);
  });

  it('marque disponible=false avec la raison "budget insuffisant" quand le prix dépasse la cagnotte', async () => {
    const { useCase } = makeFixture();

    const dto = await useCase.execute({ campaignId: 1, userId: 42 });

    // cagnotte = 29, Camion Lourd = 30
    const camionLourd = dto.find((v) => v.nomInterne === 'camion_lourd');
    expect(camionLourd?.disponible).toBe(false);
    expect(camionLourd?.raison).toContain('insuffisant');
  });

  it('le budget considéré est la cagnotte (wallet), pas team.remainingBudget', async () => {
    // team.remainingBudget seul vaudrait 38 (50 - 12) — suffisant pour les deux véhicules.
    // Le verdict doit malgré tout refuser le Camion Lourd (30) car wallet = 29 < 30.
    const { useCase } = makeFixture();

    const dto = await useCase.execute({ campaignId: 1, userId: 42 });

    expect(dto.find((v) => v.nomInterne === 'camion_lourd')?.disponible).toBe(false);
  });

  it("lève NotFoundException si l'appelant n'a pas d'équipe engagée", async () => {
    const participant = makeTestParticipant(1).participant;
    // Simule l'absence d'équipe engagée en ciblant un userId absent de la campagne.
    const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [participant], []);
    const replayService: CampaignReplayService = {
      loadAndReplay: vi.fn().mockResolvedValue(campaign),
    } as unknown as CampaignReplayService;
    const catalog: CatalogService = { getVehicleTypesForSponsor: () => [] } as unknown as CatalogService;
    const useCase = new GetWorkshopAvailableVehiclesUseCase(replayService, catalog);

    await expect(useCase.execute({ campaignId: 1, userId: 999 })).rejects.toThrow(NotFoundException);
  });
});
