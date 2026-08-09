---
id: "suppression-compte-campagne-sans-organisateur-2026-08-09"
status: "done"
priority: "high"
assignee: null
dueDate: null
created: "2026-08-09T08:25:17.000Z"
modified: "2026-08-09T09:12:48.000Z"
completedAt: "2026-08-09T09:12:48.000Z"
labels: ["bug", "backend", "audit-suppression"]
order: "aR"
---

# Suppression d'un compte peut laisser une campagne sans organisateur

## Constat

`RemoveUserUseCase` (`apps/backend/src/app/auth/application/remove-user.usecase.ts`) et
`User.assertRemovableBy` (`apps/backend/src/app/auth/domain/user.ts:239`) ne vérifient
que l'auto-suppression. La suppression d'un utilisateur cascade (`onDelete: 'CASCADE'`)
sur ses `CampaignParticipant`, dans toutes ses campagnes, sans jamais vérifier s'il est
le seul organisateur `VALIDATED` d'une campagne.

Résultat possible : une campagne orpheline, sans aucun participant
`isOrganizer=true`/`status=VALIDATED` restant, où plus aucune route organisateur
(`assertOrganizer`) ne peut plus s'exécuter, pour personne - la campagne devient
définitivement bloquée en lecture seule.

## Fichiers concernés

- `apps/backend/src/app/auth/application/remove-user.usecase.ts`
- `apps/backend/src/app/auth/domain/user.ts:239` (`assertRemovableBy`)
- À comparer avec la garde `assertNotLastOrganizer` de `apps/backend/src/app/campaign/domain/campaign.ts`

## Piste de correction envisageable

Avant suppression, vérifier via `ICampaignRepository` si l'utilisateur est organisateur
unique validé d'une campagne active, et refuser (ou exiger un transfert d'organisation
au préalable) si c'est le cas.

## Résolution

Implémenté (2026-08-09) :

- `ICampaignRepository.findCampaignsWhereSoleValidatedOrganizer(userId)` (nouvelle
  méthode, `campaign.repository.interface.ts`/`campaign.repository.ts`) - invariant
  cross-agrégat, même raisonnement qu'`isTeamEngaged`.
- `RemoveUserUseCase` refuse désormais (400) la suppression si elle laisserait une
  campagne sans organisateur `VALIDATED`, en listant les campagnes concernées dans
  le message d'erreur.
- Pour résoudre le blocage : nouvelle fonctionnalité d'**usurpation d'identité**
  ("se connecter en tant que", `POST /api/users/:id/impersonate`,
  `User.assertImpersonatableBy`, réservée aux comptes `role: 'user'`) permettant à
  l'admin d'agir temporairement comme le compte concerné pour promouvoir un
  organisateur de remplacement (écran existant `ParticipantList`), puis de revenir
  à sa session admin (bannière `ImpersonationBanner`) et retenter la suppression.
- Détail complet : [docs/spec/AUTH.md](../../../docs/spec/AUTH.md#suppression-dun-compte-engagé-comme-organisateur-de-campagne),
  [docs/spec/CAMPAIGN.md](../../../docs/spec/CAMPAIGN.md#inscription).
- Tests : `user.spec.ts`, `remove-user.usecase.spec.ts`, `impersonate-user.usecase.spec.ts`,
  `users.controller.spec.ts` (backend) ; `auth.service.spec.ts`, `admin-users.spec.ts`,
  `impersonation-banner.spec.ts`, `app.spec.ts` (frontend). 920 tests backend / 735
  tests frontend passent.

## Origine

Identifié lors de l'audit des mécanismes de suppression de l'application (analyse
complète : cascades utilisateur/équipe/véhicule, campagne/participant/partie,
event-sourcing atelier).
