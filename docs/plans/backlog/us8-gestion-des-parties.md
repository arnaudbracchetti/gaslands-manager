# US8 — Gestion des parties (Games)

> Référence : [2026-06-14-saisons-design.md](../2026-06-14-saisons-design.md)
> Dépend de : [US3](us3-valider-refuser-les-inscriptions.md)

## Description

Un organisateur planifie les parties de la saison : créer, modifier, supprimer une
partie, et sélectionner quel sous-ensemble de participants validés y participe.

## Périmètre

**Backend**
- Entités `Game`, `GameParticipant` (`apps/backend/src/app/season/`)
- `GameService.findAllForSeason(seasonId, userId)` : liste des parties (accessible
  aux participants validés, pas seulement organisateurs)
- `GameService.create(seasonId, userId, dto)` : crée la `Game` + ses
  `GameParticipant` (organisateur uniquement, rejette si la saison est `TERMINEE`)
  - valide que chaque `participantId` fourni correspond à un
    `SeasonParticipant` `VALIDATED` de cette saison
- `GameService.update(...)`, `GameService.remove(...)` : organisateur uniquement,
  rejette si `TERMINEE`
- Routes : `GET/POST /api/seasons/:id/games`, `PUT/DELETE /api/seasons/:id/games/:gameId`
- DTOs : `CreateGameDto` (`name`, `scheduledAt?`, `participantIds: number[]`),
  `GameResponseDto`
- Ajout des entités dans `app.module.ts`

**Frontend**
- Section "Parties" dans `/seasons/:id` : liste des parties (`game-card/` — nom,
  date, nombre/liste d'équipes participantes)
- Bouton "+ Ajouter" (organisateur, masqué si `TERMINEE`) ouvrant `game-form/` :
  nom, date optionnelle, sélection multiple parmi les participants validés
- Actions modifier/supprimer sur chaque `game-card/` (organisateur)
- `season-games.service.ts`, `game.model.ts`

## Conditions d'acceptation

1. **Étant donné** une saison avec des participants validés, **quand** un
   organisateur clique "+ Ajouter" et remplit le formulaire (nom + sélection de
   2 participants), **alors** une `Game` est créée avec 2 `GameParticipant`
   correspondants.
2. **Étant donné** une partie créée, **alors** elle apparaît dans la section
   "Parties" pour tous les participants validés de la saison (pas seulement les
   organisateurs), avec son nom, sa date (si renseignée) et la liste des équipes
   engagées.
3. **Étant donné** un `participantId` ne correspondant pas à un
   `SeasonParticipant` `VALIDATED` de cette saison, **quand** une création/édition
   de partie l'inclut, **alors** la requête est rejetée.
4. **Étant donné** une partie existante, **quand** un organisateur modifie son nom,
   sa date ou sa liste de participants via `game-form`, **alors** les changements
   sont persistés et reflétés dans `game-card/`.
5. **Étant donné** une partie existante, **quand** un organisateur la supprime
   (avec confirmation), **alors** elle disparaît de la liste et ses
   `GameParticipant` sont supprimés en cascade.
6. **Étant donné** une saison `TERMINEE`, **alors** les actions "+ Ajouter",
   "Modifier" et "Supprimer" ne sont plus disponibles dans l'UI, et les appels API
   correspondants sont rejetés.
7. **Étant donné** un utilisateur non-organisateur, **quand** il appelle
   directement `POST/PUT/DELETE /api/seasons/:id/games...`, **alors** la requête
   échoue (404).
