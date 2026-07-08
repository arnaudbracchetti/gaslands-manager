import { describe, it, expect } from 'vitest';
import { DomainException } from '../../shared/domain/domain-exception';
import { makeTestParticipant } from './test-helpers';

describe('CampaignParticipant.assertCanAfford', () => {
  it('ne lève pas quand la cagnotte couvre le coût', () => {
    const { participant } = makeTestParticipant(); // wallet = 29 (remainingBudget)
    expect(() => participant.assertCanAfford(20)).not.toThrow();
  });

  it('ne lève pas quand le coût égale la cagnotte', () => {
    const { participant } = makeTestParticipant();
    expect(() => participant.assertCanAfford(29)).not.toThrow();
  });

  it('lève DomainException quand le coût dépasse la cagnotte', () => {
    const { participant } = makeTestParticipant();
    expect(() => participant.assertCanAfford(30)).toThrow(DomainException);
    expect(() => participant.assertCanAfford(30)).toThrow('Cagnotte insuffisante');
  });
});
