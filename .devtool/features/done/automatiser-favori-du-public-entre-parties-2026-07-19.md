---
id: "automatiser-favori-du-public-entre-parties-2026-07-19"
status: "done"
priority: "medium"
assignee: null
epic: null
dueDate: null
created: "2026-07-19T00:00:00.000Z"
modified: "2026-07-21T19:34:37.546Z"
completedAt: "2026-07-21T19:34:37.546Z"
labels: ["mode-campagne", "degats-sequelles"]
order: "Zw"
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

- [x] Étant donné un véhicule qui obtient le résultat `FAVORI_DU_PUBLIC` sur la
      Table des Épaves, quand ce résultat est résolu, alors l'état "Favori du
      Public" est persisté sur le véhicule (`Vehicle.hasFavoriDuPublic`, dérivé par
      replay — jamais en colonne — posé par `WreckResolvedEvent` quand
      `wreckResult = FAVORI_DU_PUBLIC`).
- [x] Étant donné un véhicule portant ce statut, quand l'organisateur arrive à
      l'écran `WreckDesignationStep` d'une partie ultérieure et désigne ce véhicule
      non-intact, alors la case "Favori du public" **apparaît** pour ce véhicule
      (et seulement pour lui) — **révision par rapport au critère initial** : elle
      n'est PAS pré-cochée automatiquement. Le joueur doit activement la cocher
      pour déclarer qu'il choisit de dépenser 3 votes du public (ressource non
      trackée par l'app, décision sur l'honneur) ; la voir apparaître suffit à ne
      plus dépendre de sa mémoire pour savoir QUAND la question se pose.
- [x] Étant donné un véhicule dont le bonus vient d'être crédité (case cochée +
      véhicule désigné non-intact — **indépendamment du résultat du tirage de
      cette partie**, cf. révision de règle ci-dessous), quand le tirage est
      résolu, alors le statut est levé (`FavoriDuPublicBonusEvent` consomme
      `hasFavoriDuPublic`) — le bonus ne peut pas être crédité deux fois.
- [x] Non-régression : le comportement actuel (case manuelle, cochable/décochable
      librement) reste possible — cette story ajoute une visibilité conditionnelle
      intelligente, elle ne retire pas le contrôle manuel de l'organisateur.

**Révision de règle (post-implémentation initiale)** : le premier jet liait le
crédit du bonus au résultat `VEHICULE_DETRUIT` du tirage de la partie courante.
Correction demandée : le bonus est crédité dès que le véhicule est désigné
non-intact (mis en épave, par un participant ou seul) à cette partie et que la
case est cochée — **quel que soit le résultat du tirage** (`Débosselé`, `Arraché`,
`Véhicule détruit`… peu importe). Seule la mise en épave déclarée à l'écran
Désignation compte, pas l'issue du dé. Les 3 statuts de cet écran ont aussi été
renommés à cette occasion pour retirer le terme "détruit" : *Intact* / *Mis en
épave par [participant]* / *Mis en épave seul*.

## Notes

Cf. `docs/spec/CAMPAIGN.md` (section Wizard de fin de partie, écran 5 — Désignation
des épaves) pour le comportement actuel complet de l'écran et l'output
`WreckDesignationResult` transmis à `WreckResolutionStep`.