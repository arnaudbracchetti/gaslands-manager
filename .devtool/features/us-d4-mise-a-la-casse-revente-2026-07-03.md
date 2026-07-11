---
id: "us-d4-mise-a-la-casse-revente-2026-07-03"
status: "done"
priority: "medium"
assignee: null
dueDate: null
created: "2026-07-03T19:28:55.333Z"
modified: "2026-07-11T00:00:00.000Z"
completedAt: "2026-07-11T00:00:00.000Z"
labels: ["mode-campagne", "cagnotte-atelier"]
order: "a5"
---

# Mise à la Casse (revente)

En tant que joueur, je veux revendre un véhicule/arme/amélioration, afin de
récupérer une partie de la cagnotte.

## Critères d'acceptation

- [x] Étant donné une arme/amélioration achetée (pré-existante), quand je la mets à
      la casse, alors je reçois la moitié de son coût d'achat arrondie à l'inférieur
      (p.170) — dérivé du budget d'équipe (`Team.remainingBudget`), pas via un
      mouvement `WalletMovementEvent` séparé. Contrairement au critère d'origine, la
      ligne n'est **pas retirée** : elle reste visible, barrée, avec un badge "Vendue"
      (traçabilité — conception affinée le 2026-07-11, cf.
      [design](../../docs/plans/2026-07-11-atelier-annulation-revente-design.md)).
      Un véhicule revendu, lui, reste sur l'ancien modèle (ligne retirée, remboursement
      plein) — hors scope de cette conception.
- [x] Étant donné un véhicule revendu, quand je consulte son équipement, alors ses
      avantages sont perdus (transfert d'avantages interdit, p.170).

## Vérification code (2026-07-11)

Bug corrigé : `Game.resolveSell` (`game.ts`) calcule désormais `Math.floor(price/2)`
pour WEAPON/IMPROVEMENT (`Weapon.price`/`Improvement.price` gèrent le cas Tourelle
assignée). `EquipmentChangedEvent.execute()`/`undo()` ne créditent plus jamais le
wallet directement — `CampaignParticipant.wallet` est un getter dérivé de
`Team.remainingBudget` + récompenses. Un nouveau flag `isSold` (mirroir d'`isLost`)
remplace la suppression de la ligne pour WEAPON/IMPROVEMENT ; le véhicule (SELL)
reste sur l'ancien modèle de suppression complète. UI : `MountedEquipment` affiche
un badge "Vendue" (barré) au lieu du bouton Retirer une fois l'objet vendu ;
`EquipmentManager` distingue "Annuler l'achat" (objet acheté cette session) de
"Revendre pour N jerricans (50%)" (objet pré-existant) — cf. US-D4/R4 fusionnée avec
l'annulation d'achat dans la même passe d'implémentation.
