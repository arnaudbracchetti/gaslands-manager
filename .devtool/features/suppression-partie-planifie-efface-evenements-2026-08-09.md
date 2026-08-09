---
id: "suppression-partie-planifie-efface-evenements-2026-08-09"
status: "backlog"
priority: "medium"
assignee: null
dueDate: null
created: "2026-08-09T08:25:17.000Z"
modified: "2026-08-09T08:25:17.000Z"
completedAt: null
labels: ["bug", "backend", "audit-suppression"]
order: "aU"
---

# Suppression d'une partie PLANIFIE peut effacer des événements déjà journalisés par le wizard

## Constat

`Campaign.removeGame()` (`apps/backend/src/app/campaign/domain/campaign.ts:317-325`)
garde uniquement le statut de la partie (`assertManageable` + `assertPlanifie`) - une
partie `ATELIER`/`JOUE` est bien protégée. Mais le wizard de fin de partie
(`Game.recordResult`) journalise déjà des événements (classement, exploits, points de
résistance, jerricans) **avant** que la partie n'entre en atelier : elle reste
`PLANIFIE` jusqu'au clic "Terminer" de l'écran Résolution.

Dans cette fenêtre (résultat enregistré mais atelier pas encore ouvert), `removeGame`
reste autorisé et supprime silencieusement, via cascade SQL (`onDelete: 'CASCADE'` sur
`game_events.gameId`), tous ces événements déjà enregistrés - un comportement
équivalent à un reset complet, mais en dehors du flux `ResetResultUseCase` prévu
explicitement pour cet usage (`DELETE .../games/:gameId/results`), sans les mêmes
garanties/intentions.

## Fichiers concernés

- `apps/backend/src/app/campaign/domain/campaign.ts` (`removeGame` lignes 317-325)
- À comparer avec `Game.resultEventIdsForReset`
  (`apps/backend/src/app/campaign/domain/games/game.ts:599-604`) et `ResetResultUseCase`

## Piste de correction envisageable

`removeGame` pourrait refuser la suppression (ou exiger de passer explicitement par un
reset au préalable) si `game.events.length > 0`, pour distinguer une partie `PLANIFIE`
vide d'une partie `PLANIFIE` dont le résultat est déjà partiellement/totalement
enregistré.

## Origine

Identifié lors de l'audit des mécanismes de suppression de l'application.
