---
id: "automatiser-favori-du-public-entre-parties-2026-07-19"
status: "todo"
priority: "medium"
assignee: null
epic: null
dueDate: null
created: "2026-07-19T00:00:00.000Z"
modified: "2026-07-19T06:20:29.739Z"
completedAt: null
labels: ["mode-campagne", "degats-sequelles"]
order: "a2"
---
# Automatiser l'attestation "Favori du Public" entre deux parties

En tant qu'organisateur, je veux que l'application se souvienne elle-même qu'un
véhicule porte un bonus "Favori du Public" en attente, afin de ne plus dépendre de
ma mémoire pour recocher la case au bon moment lors d'une partie ultérieure.

## Contexte

`FavoriDuPublicBonusEvent` (`apps/backend/src/app/campaign/domain/events/favori-du-public-bonus.event.ts`)
crédite +5 PC au propriétaire d'un véhicule quand ce véhicule obtient
`VEHICULE_DETRUIT` sur la Table des Épaves — **mais uniquement si** l'organisateur a
manuellement recoché la case "Favori du public" pour ce véhicule à l'écran
`WreckDesignationStep` de **cette partie précise**. Le commentaire de la classe le
documente explicitement : l'attestation est manuelle, "l'app ne mémorise aucun état
entre deux parties".

Concrètement : un véhicule qui obtient le résultat `FAVORI_DU_PUBLIC` (ligne 9 de la
Table des Épaves, +3 Chocs, cf. `apps/backend/src/app/campaign/domain/wreck/wreck-table.ts`)
lors de la partie N ne laisse aucune trace persistée de ce statut. À la partie N+1,
si ce même véhicule est enfin détruit, l'organisateur doit se souvenir sans aide de
l'application qu'il portait ce bonus en attente et recocher la case correspondante
dans `WreckDesignationStep` (`apps/frontend/src/app/campaigns/game-result-wizard/wreck-designation-step/`)
— sinon les +5 PC ne sont jamais crédités, silencieusement.

## Critères d'acceptation

- [ ] Étant donné un véhicule qui obtient le résultat `FAVORI_DU_PUBLIC` sur la
      Table des Épaves, quand ce résultat est résolu, alors l'état "Favori du
      Public en attente" est persisté sur le véhicule (ou dérivable par replay des
      événements existants — `WreckResolvedEvent` avec `wreckResult = FAVORI_DU_PUBLIC`
      pas encore suivi d'un `FavoriDuPublicBonusEvent` pour ce véhicule).
- [ ] Étant donné un véhicule portant ce statut en attente, quand l'organisateur
      arrive à l'écran `WreckDesignationStep` d'une partie ultérieure, alors la case
      "Favori du public" est pré-cochée automatiquement pour ce véhicule (reste
      modifiable manuellement — le cas où le pilote change réellement de statut
      entre deux parties n'est pas à exclure).
- [ ] Étant donné un véhicule dont le bonus vient d'être crédité
      (`VEHICULE_DETRUIT` + case cochée), quand le tirage est résolu, alors le
      statut "en attente" est levé — le bonus ne peut pas être crédité deux fois.
- [ ] Non-régression : le comportement actuel (case manuelle, cochable/décochable
      librement) reste possible — cette story ajoute une pré-sélection intelligente,
      elle ne retire pas le contrôle manuel de l'organisateur.

## Notes

Cf. `docs/spec/CAMPAIGN.md` (section Wizard de fin de partie, écran 5 — Désignation
des épaves) pour le comportement actuel complet de l'écran et l'output
`WreckDesignationResult` transmis à `WreckResolutionStep`.