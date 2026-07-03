import { describe, it, expect } from 'vitest';
import { DomainException } from '../../shared/domain/domain-exception';
import { makeTestParticipant } from './test-helpers';

describe('CampaignParticipant.assertCanAfford', () => {
  it('ne lève pas quand la cagnotte couvre le coût', () => {
    const { participant } = makeTestParticipant(); // wallet = 50 (team.cans)
    expect(() => participant.assertCanAfford(30)).not.toThrow();
  });

  it('ne lève pas quand le coût égale la cagnotte', () => {
    const { participant } = makeTestParticipant();
    expect(() => participant.assertCanAfford(50)).not.toThrow();
  });

  it('lève DomainException quand le coût dépasse la cagnotte', () => {
    const { participant } = makeTestParticipant();
    expect(() => participant.assertCanAfford(60)).toThrow(DomainException);
    expect(() => participant.assertCanAfford(60)).toThrow('Cagnotte insuffisante');
  });
});
