import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { GetWorkshopAvailableSequellesUseCase } from './get-workshop-available-sequelles.usecase';
import type { CampaignReplayService } from '../infrastructure/campaign-replay.service';
import type { CatalogService } from '../../catalog/catalog.service';
import { SequellaType } from '../../team/domain/value-objects/sequella-type';
import { Campaign } from '../domain/campaign';
import { CampaignState } from '../domain/enums/campaign.enums';
import { makeTestParticipant } from '../domain/test-helpers';

const SUICIDAIRE = SequellaType.from({
  nom: 'Suicidaire', nom_interne: 'suicidaire', description: 'Texte.', chocs_cost: 1, origine: 'ATELIER',
});
const LEGENDE_VIVANTE = SequellaType.from({
  nom: 'Légende Vivante', nom_interne: 'legende_vivante', description: 'Texte.', chocs_cost: 11, origine: 'ATELIER',
});
const SIEGE_IRRECUPERABLE = SequellaType.from({
  nom: 'Siège irrécupérable', nom_interne: 'siege_irrecuperable', description: 'Texte.', chocs_cost: 0, origine: 'TABLE_EPAVES',
});

function makeFixture(chocs = 0) {
  const { participant, vehicle } = makeTestParticipant(1);
  vehicle.addChocs(chocs);
  const campaign = new Campaign(1, 'Campagne Test', CampaignState.EN_COURS, 'invite-code', [participant], []);
  const replayService: CampaignReplayService = {
    loadAndReplay: vi.fn().mockResolvedValue(campaign),
  } as unknown as CampaignReplayService;
  const catalog: CatalogService = {
    getAllSequellaTypes: () => [SUICIDAIRE, LEGENDE_VIVANTE, SIEGE_IRRECUPERABLE],
  } as unknown as CatalogService;
  const useCase = new GetWorkshopAvailableSequellesUseCase(replayService, catalog);
  return { useCase, vehicle };
}

describe('GetWorkshopAvailableSequellesUseCase', () => {
  it('exclut les séquelles TABLE_EPAVES — jamais achetables directement en atelier', async () => {
    const { useCase } = makeFixture(20);

    const dto = await useCase.execute({ campaignId: 1, vehicleId: 1, userId: 42 });

    expect(dto.map((s) => s.nomInterne)).toEqual(['suicidaire', 'legende_vivante']);
  });

  it('marque disponible=true quand les Chocs suffisent', async () => {
    const { useCase } = makeFixture(5);

    const dto = await useCase.execute({ campaignId: 1, vehicleId: 1, userId: 42 });

    const suicidaire = dto.find((s) => s.nomInterne === 'suicidaire');
    expect(suicidaire?.disponible).toBe(true);
    expect(suicidaire?.chocsCost).toBe(1);
  });

  it('marque disponible=false avec la raison "Chocs insuffisants" quand le solde est trop bas', async () => {
    const { useCase } = makeFixture(0);

    const dto = await useCase.execute({ campaignId: 1, vehicleId: 1, userId: 42 });

    const legendeVivante = dto.find((s) => s.nomInterne === 'legende_vivante');
    expect(legendeVivante?.disponible).toBe(false);
    expect(legendeVivante?.raison).toContain('Chocs insuffisants');
  });

  it('marque disponible=false quand la séquelle est déjà acquise sur ce véhicule', async () => {
    const { useCase, vehicle } = makeFixture(20);
    vehicle.addCampaignSequella(SUICIDAIRE, 1);

    const dto = await useCase.execute({ campaignId: 1, vehicleId: 1, userId: 42 });

    const suicidaire = dto.find((s) => s.nomInterne === 'suicidaire');
    expect(suicidaire?.disponible).toBe(false);
    expect(suicidaire?.raison).toContain('déjà acquise');
  });

  it('lève NotFoundException si le véhicule n\'appartient pas à l\'équipe du participant', async () => {
    const { useCase } = makeFixture(20);

    await expect(useCase.execute({ campaignId: 1, vehicleId: 999, userId: 42 })).rejects.toThrow(NotFoundException);
  });
});
