# US1 — Créer une saison

> Référence : [2026-06-14-saisons-design.md](../2026-06-14-saisons-design.md)

## Description

Un utilisateur connecté crée une nouvelle saison en lui donnant un nom et en
choisissant l'une de ses équipes pour y participer en tant qu'organisateur.

## Périmètre

**Backend**
- Entités `Season`, `SeasonParticipant`, enums `SeasonState`, `ParticipantStatus`
  (`apps/backend/src/app/season/`)
- `SeasonService.create(userId, dto)` : crée la `Season` (`state: EN_CONSTRUCTION`,
  génère `inviteCode`) + le `SeasonParticipant` du créateur
  (`isOrganizer: true`, `status: VALIDATED`, `teamId` choisi)
- `SeasonService.findAll(userId)` : saisons où l'utilisateur a un `SeasonParticipant`
  (tous statuts confondus, pour l'instant — affinage US4)
- Routes : `POST /api/seasons`, `GET /api/seasons`
- DTOs : `CreateSeasonDto` (`name`, `teamId`), `SeasonResponseDto`
  (Season + `participantCount`, `myRole`)
- Ajout des entités dans `app.module.ts` (liste TypeORM `entities`)

**Frontend**
- Route `/seasons` (protégée par `authGuard`)
- `Seasons` (smart) : charge et affiche la liste de saisons via `seasons.service.ts`
- `season-card/` (dumb) : affiche nom, état, badge de rôle (🏆 Organisateur)
- Modale "Créer une saison" (`season-form` ou réutilisation du pattern `team-form`) :
  champ `name` + select d'une équipe de l'utilisateur (réutilise `teams.service.ts`
  pour lister ses équipes)
- `seasons.service.ts`, `season.model.ts`

## Conditions d'acceptation

1. **Étant donné** un utilisateur connecté possédant au moins une équipe,
   **quand** il clique sur "+ Créer une saison", saisit un nom et sélectionne une
   équipe, **alors** une nouvelle saison est créée avec l'état `EN_CONSTRUCTION` et
   un `inviteCode` généré.
2. **Étant donné** une saison nouvellement créée, **alors** son créateur apparaît
   comme `SeasonParticipant` avec `isOrganizer: true` et `status: VALIDATED`, associé
   à l'équipe choisie.
3. **Étant donné** un utilisateur n'ayant aucune équipe, **alors** la modale de
   création empêche la soumission (pas d'équipe à sélectionner) ou affiche un message
   l'invitant à créer une équipe d'abord.
4. **Étant donné** l'utilisateur sur `/seasons`, **alors** il voit la saison qu'il
   vient de créer dans la liste, avec le badge "🏆 Organisateur" et l'état
   `EN_CONSTRUCTION` affichés.
5. **Étant donné** un utilisateur non connecté, **quand** il accède à `/seasons`,
   **alors** il est redirigé vers `/login` (comportement `authGuard` existant).
6. **Étant donné** deux utilisateurs distincts ayant chacun créé une saison,
   **alors** chacun ne voit que ses propres saisons dans `/api/seasons` /
   `/seasons`.
