---
id: "commentaire-trompeur-game-event-append-only-2026-08-09"
status: "backlog"
priority: "low"
assignee: null
dueDate: null
created: "2026-08-09T08:25:17.000Z"
modified: "2026-08-09T08:25:17.000Z"
completedAt: null
labels: ["documentation", "backend", "audit-suppression"]
order: "aV"
---

# Commentaire trompeur sur GameEventOrm - la table game_events n'est pas réellement append-only

## Constat

L'entité `GameEventOrm`
(`apps/backend/src/app/campaign/infrastructure/entities/game-event.entity.ts:19-21`)
porte un commentaire affirmant que la table `game_events` "n'est jamais modifiée après
insertion" (journal append-only). Or `ICampaignRepository.deleteEvent()`/
`deleteEvents()` (`campaign.repository.ts:120-132`) exécutent bien de vraies
suppressions SQL sur cette table, utilisées par deux mécanismes légitimes et
documentés dans `docs/spec/CAMPAIGN.md` : l'annulation d'un achat de la session
d'atelier en cours (`Game.changeEquipment`) et le reset complet des résultats d'une
partie (`ResetResultUseCase`).

Le comportement lui-même est voulu et correctement documenté ailleurs - seul le
commentaire de l'entité ORM est inexact et pourrait induire en erreur un futur
développeur qui s'appuierait sur cette hypothèse (ex. pour du cache, de l'audit, ou une
optimisation supposant l'immutabilité du journal).

## Fichiers concernés

- `apps/backend/src/app/campaign/infrastructure/entities/game-event.entity.ts:19-21`

## Piste de correction envisageable

Reformuler le commentaire pour préciser que le journal est append-only SAUF pour les
deux cas explicites de suppression ciblée (annulation même-session, reset de résultat
`PLANIFIE`), avec un renvoi vers la section correspondante de `docs/spec/CAMPAIGN.md`.

## Origine

Identifié lors de l'audit des mécanismes de suppression de l'application.
