---
id: "tests-manquants-cascades-suppression-2026-08-09"
status: "backlog"
priority: "low"
assignee: null
dueDate: null
created: "2026-08-09T08:25:17.000Z"
modified: "2026-08-09T08:25:17.000Z"
completedAt: null
labels: ["tests", "backend", "audit-suppression"]
order: "aW"
---

# Aucun test ne vérifie les cascades de suppression sur une vraie base de données

## Constat

Aucun test e2e (`apps/backend-e2e/`) ni unitaire ne vérifie qu'une action de
suppression produit effectivement la cascade SQL attendue (`onDelete: 'CASCADE'`,
`orphanedRowAction: 'delete'`). Les specs unitaires existants pour les use cases
`remove-*` (ex. `remove-advantage.usecase.spec.ts`,
`remove-improvement.usecase.spec.ts`, `remove-weapon.usecase.spec.ts`,
`team.controller.spec.ts`, `users.controller.spec.ts`) mockent systématiquement le
repository - ils valident la logique applicative (gardes métier, appels) mais jamais le
comportement SQL réel.

Il n'existe aucun test `remove-vehicle.usecase.spec.ts` ni
`remove-team.usecase.spec.ts`. Aucun test e2e ne couvre la suppression d'un
utilisateur, d'une équipe, d'une campagne ou d'un participant contre la base de test
réelle (`gaslands_test`) pour vérifier que les lignes attendues (et seulement
celles-là) disparaissent.

## Fichiers concernés

- `apps/backend-e2e/`
- `apps/backend/src/app/team/application/remove-*.spec.ts`
- `apps/backend/src/app/auth/users.controller.spec.ts`
- `apps/backend/src/app/team/team.controller.spec.ts`

## Piste de correction envisageable

Ajouter des tests e2e (`backend-e2e`, skill `e2e-testing`) qui créent un jeu de données
représentatif (utilisateur + équipe + véhicule + équipement + campagne + participant +
partie + événements), déclenchent chaque suppression, puis vérifient en base
exactement quelles lignes ont disparu et lesquelles ont survécu - notamment pour
couvrir les cartes suivantes une fois corrigées (tests de non-régression) :

- [Suppression d'un compte peut laisser une campagne sans organisateur](./suppression-compte-campagne-sans-organisateur-2026-08-09.md)
- [Suppression d'une équipe contourne la garde "dernier organisateur" d'une campagne](./suppression-equipe-contourne-garde-organisateur-2026-08-09.md)
- [Retrait d'un participant de campagne sans garde sur l'historique](./retrait-participant-sans-garde-historique-2026-08-09.md)
- [Suppression d'une partie PLANIFIE peut effacer des événements déjà journalisés](./suppression-partie-planifie-efface-evenements-2026-08-09.md)

## Origine

Identifié lors de l'audit des mécanismes de suppression de l'application.
