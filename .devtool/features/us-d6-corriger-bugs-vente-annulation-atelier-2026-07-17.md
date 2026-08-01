---
id: "us-d6-corriger-bugs-vente-annulation-atelier-2026-07-17"
status: "todo"
priority: "high"
assignee: null
epic: null
dueDate: null
created: "2026-07-17T00:00:00.000Z"
modified: "2026-07-29T00:00:00.000Z"
completedAt: null
labels: ["mode-campagne", "cagnotte-atelier"]
order: "a0"
---
# Corriger les bugs de vente/annulation en Atelier

En tant que joueur, je veux que les opérations de vente et d'annulation d'achat en
Atelier respectent les règles métier sans incohérences, afin que mon équipe reste
toujours dans un état légal.

## Critères d'acceptation

- [ ] Étant donné un véhicule pré-existant dont une arme/amélioration a été
      achetée *dans la session en cours*, quand je revends le véhicule entier,
      alors les éléments achetés cette session sont remboursés au plein tarif
      (annulation), pas à moitié prix (revente).
- [ ] Étant donné un équipement acheté cette session, quand j'annule son achat,
      alors les événements de la même session survenus *après* lui sont revérifiés
      — si l'un devient illégal (ex. capacité dépassée), l'annulation est rejetée
      avec un message explicite à l'utilisateur.

## Notes

Bugs documentés dans `docs/spec/CAMPAIGN.md#annulation-dachat-vs-revente` comme
"limitations connues". Priorité relevée à `high` le 2026-07-29 (confirmée par
l'utilisateur comme l'une des deux priorités du prochain cycle, avec US-D3).

## Vérification code (2026-07-29)

Les deux bugs sont confirmés toujours présents :
- **Bug 1** (rejeu post-annulation) : `game.ts:337-343` — retour immédiat dès
  qu'un `BUY` de la session est retrouvé, sans revalidation des événements
  postérieurs de cette même session.
- **Bug 2** (remboursement à 50% au lieu du plein tarif) : `game.ts:411-419`
  (`findSameSessionPurchase` ne teste que le véhicule lui-même pour un SELL
  VEHICLE, jamais son équipement) combiné à `vehicle.ts:192-205`
  (`Vehicle.resaleRefund`, sans aucune notion de session) et `weapon.ts:56`
  (`Weapon.resaleRefund` toujours `Math.floor(price / 2)`, inconditionnel).