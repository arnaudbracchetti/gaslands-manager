---
id: "suppression-equipe-contourne-garde-organisateur-2026-08-09"
status: "backlog"
priority: "high"
assignee: null
dueDate: null
created: "2026-08-09T08:25:17.000Z"
modified: "2026-08-09T08:25:17.000Z"
completedAt: null
labels: ["bug", "backend", "audit-suppression"]
order: "aS"
---

# Suppression d'une équipe contourne la garde "dernier organisateur" d'une campagne

## Constat

`RemoveTeamUseCase` (`apps/backend/src/app/team/application/remove-team.usecase.ts`) ne
vérifie que `Team.assertNotLocked()` (verrouillage si campagne `EN_COURS`/`TERMINEE`).
Il ne vérifie jamais si l'équipe est engagée (participant `VALIDATED`) dans une campagne
encore `EN_CONSTRUCTION` (donc non verrouillée).

Supprimer une telle équipe fait disparaître en cascade SQL le `CampaignParticipant`
correspondant (`campaign_participants.teamId`, `onDelete: 'CASCADE'`) sans jamais passer
par la méthode `Campaign.removeParticipant()` de l'agrégat domaine - donc sans jamais
déclencher sa garde `assertNotLastOrganizer`.

C'est un chemin de contournement direct de la carte
[Suppression d'un compte peut laisser une campagne sans organisateur](./suppression-compte-campagne-sans-organisateur-2026-08-09.md) :
un organisateur unique validé peut supprimer sa propre équipe pour rendre sa campagne
orpheline, en évitant complètement la garde métier prévue à cet effet.

## Fichiers concernés

- `apps/backend/src/app/team/application/remove-team.usecase.ts`
- À comparer avec `apps/backend/src/app/campaign/domain/campaign.ts`
  (`removeParticipant`, `assertNotLastOrganizer`)

## Piste de correction envisageable

`RemoveTeamUseCase` devrait vérifier, via le repository campagne, si l'équipe est
engagée dans une campagne `EN_CONSTRUCTION` avant de supprimer, et appliquer la même
garde `assertNotLastOrganizer` que `removeParticipant` (ou refuser la suppression tant
que l'équipe est engagée, en demandant de se désengager explicitement au préalable).

## Origine

Identifié lors de l'audit des mécanismes de suppression de l'application.
