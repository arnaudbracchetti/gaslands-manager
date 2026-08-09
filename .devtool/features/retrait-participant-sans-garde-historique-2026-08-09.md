---
id: "retrait-participant-sans-garde-historique-2026-08-09"
status: "backlog"
priority: "medium"
assignee: null
dueDate: null
created: "2026-08-09T08:25:17.000Z"
modified: "2026-08-09T08:25:17.000Z"
completedAt: null
labels: ["bug", "backend", "audit-suppression"]
order: "aT"
---

# Retrait d'un participant de campagne sans garde sur l'historique d'événements déjà journalisé

## Constat

`Campaign.removeParticipant()` (`apps/backend/src/app/campaign/domain/campaign.ts:243-250`)
ne garde que `assertConstruction` (campagne `EN_CONSTRUCTION`) et
`assertNotLastOrganizer`. Contrairement à `changeParticipantTeam`
(`campaign.ts:258-277`), qui bloque explicitement via `hasParticipantHistory` si le
participant a déjà des `GameEvent` journalisés (pour ne pas casser un futur replay),
`removeParticipant` n'a aucune garde équivalente.

Comme les transitions d'état de campagne sont bidirectionnelles (une campagne
`EN_COURS` peut redevenir `EN_CONSTRUCTION`), il est possible de retirer un participant
qui a déjà joué des parties `JOUE` (figées) : la suppression SQL de
`campaign_participants` cascade alors sur tous ses `game_events`
(`onDelete: 'CASCADE'` sur `participantId`), effaçant définitivement et silencieusement
son historique de campagne (classement, exploits, mouvements de cagnotte, tirages
Table des Épaves) sur des parties pourtant déjà jouées et figées.

## Fichiers concernés

- `apps/backend/src/app/campaign/domain/campaign.ts` (`removeParticipant` lignes
  243-250, à comparer avec `changeParticipantTeam` lignes 258-277 et
  `hasParticipantHistory`)

## Piste de correction envisageable

Ajouter la même garde `hasParticipantHistory(participantId)` à `removeParticipant` que
celle déjà présente sur `changeParticipantTeam`, avec un message d'erreur explicite
invitant à passer par "Refuser" (réversible) plutôt que "Retirer" (définitif) si le
participant a déjà un historique.

## Origine

Identifié lors de l'audit des mécanismes de suppression de l'application.
