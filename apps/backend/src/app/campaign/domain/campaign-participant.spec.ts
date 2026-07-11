import { describe, it, expect } from 'vitest';
import { DomainException } from '../../shared/domain/domain-exception';
import { makeTestParticipant, makeWeaponType } from './test-helpers';

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

/**
 * Le wallet n'est plus un compteur mutable : il est dérivé de `team.remainingBudget`
 * (arbre d'équipement) + récompenses cumulées. Ces tests matérialisent la preuve
 * algébrique de l'équivalence avec l'ancien compteur (cf. §3 du document de conception,
 * docs/plans/2026-07-11-atelier-annulation-revente-design.md) en enchaînant achat,
 * revente et récompense dans plusieurs ordres.
 */
describe('CampaignParticipant.wallet (dérivé)', () => {
  it('vaut team.remainingBudget quand aucune récompense n\'a été créditée', () => {
    const { participant } = makeTestParticipant(); // remainingBudget = 29
    expect(participant.wallet).toBe(29);
  });

  it('augmente d\'un montant crédité en récompense (WalletMovementEvent RECOMPENSE)', () => {
    const { participant } = makeTestParticipant();
    participant.creditWallet(10);
    expect(participant.wallet).toBe(39);
  });

  it('diminue du prix catalogue quand un achat ajoute une entité transiente à l\'arbre', () => {
    const { participant, vehicle } = makeTestParticipant();
    participant.team.addCampaignWeapon(vehicle.id, makeWeaponType(), null, -1);
    expect(participant.wallet).toBe(29 - 5); // prix catalogue de makeWeaponType() = 5
  });

  it('augmente de floor(prix/2) quand une arme PRÉ-EXISTANTE est marquée vendue (revente)', () => {
    const { participant, vehicle, weapon } = makeTestParticipant();
    participant.team.markWeaponSold(vehicle.id, weapon.id);
    // prix résiduel ceil(5/2)=3 au lieu de 5 → coût du véhicule baisse de 2 → wallet +2.
    expect(participant.wallet).toBe(31);
  });

  it('achat, récompense puis revente du même objet — le total net est cohérent quel que soit l\'ordre', () => {
    const { participant, vehicle } = makeTestParticipant();

    const bought = participant.team.addCampaignWeapon(vehicle.id, makeWeaponType(), null, -1);
    expect(participant.wallet).toBe(24); // 29 − 5 (achat)

    participant.creditWallet(10);
    expect(participant.wallet).toBe(34); // 24 + 10 (récompense)

    participant.team.markWeaponSold(vehicle.id, bought.id);
    // Le coût de l'arme transiente passe de 5 (plein) à ceil(5/2)=3 (résiduel) → +2.
    expect(participant.wallet).toBe(36);
  });

  it('reset() remet les récompenses à zéro mais le wallet reste dérivé de l\'équipe (remainingBudget)', () => {
    const { participant, team } = makeTestParticipant();
    participant.creditWallet(10);
    expect(participant.wallet).toBe(39);

    participant.reset();
    expect(participant.wallet).toBe(team.remainingBudget);
  });
});
