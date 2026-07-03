---
id: "us-d4-mise-a-la-casse-revente-2026-07-03"
status: "backlog"
priority: "medium"
assignee: null
dueDate: null
created: "2026-07-03T19:28:55.333Z"
modified: "2026-07-03T19:41:13.716Z"
completedAt: null
labels: ["mode-campagne", "cagnotte-atelier"]
order: "a5"
---

# Mise à la Casse (revente)

En tant que joueur, je veux revendre un véhicule/arme/amélioration, afin de
récupérer une partie de la cagnotte.

## Critères d'acceptation

- [ ] Étant donné un item acheté, quand je le mets à la casse, alors je reçois la
      moitié de son coût d'achat arrondie à l'inférieur (p.170) via un mouvement
      REVENTE, et la ligne est retirée.
- [x] Étant donné un véhicule revendu, quand je consulte son équipement, alors ses
      avantages sont perdus (transfert d'avantages interdit, p.170).

## Vérification code (2026-07-03)

Repassée de `done` à `backlog` — **bug réel identifié** : `change-equipment.usecase.ts:79-86`
crédite le **prix plein** de l'item en SELL (pas de `Math.floor(price/2)`), et
`EquipmentChangedEvent.execute()` (`equipment-changed.event.ts:55-56`) applique ce
montant intégral. Le mouvement est en outre tagué via l'opération `EquipmentChanged`
et non un `WalletMovementEvent` `WalletReason.REVENTE` (cet enum n'est câblé que sur
l'endpoint manuel séparé). Le retrait de la ligne fonctionne (entité transiente
retirée au replay, `team.ts:186-190`) et la perte des avantages du véhicule revendu
est correcte. Pas d'UI frontend pour déclencher cette action (cf. US-D1).
