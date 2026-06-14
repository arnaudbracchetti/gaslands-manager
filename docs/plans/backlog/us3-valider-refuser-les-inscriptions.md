# US3 — Valider/refuser les inscriptions

> Référence : [2026-06-14-saisons-design.md](../2026-06-14-saisons-design.md)
> Dépend de : [US2](us2-rejoindre-une-saison-via-code.md)

## Description

Un organisateur consulte le détail d'une saison, voit la liste des participants
validés et des demandes en attente, et peut valider ou refuser chaque demande.

## Périmètre

**Backend**
- `SeasonService.findOne(id, userId)` : détail d'une saison (accessible si
  `SeasonParticipant` avec `status: VALIDATED` pour cet utilisateur, sinon
  `NotFoundException`)
- `SeasonParticipantService.findParticipants(seasonId, userId)` : liste tous les
  `SeasonParticipant` (avec infos utilisateur + nom d'équipe), groupable
  côté frontend par `status`
- `SeasonParticipantService.validate(seasonId, pid, organizerUserId, accept)` :
  passe `status` à `VALIDATED` ou `REJECTED` — organisateur uniquement
  (`assertOrganizer`)
- Routes : `GET /api/seasons/:id`, `GET /api/seasons/:id/participants`,
  `PUT /api/seasons/:id/participants/:pid/validate`
- DTOs : `SeasonParticipantResponseDto`, `ValidateParticipantDto` (`accept`)

**Frontend**
- Route `/seasons/:id` (smart `SeasonDetail`, `authGuard`)
- Section "Participants" : deux listes — "Validés" et "En attente de validation"
  (composant `participant-list/`)
- Boutons "Valider"/"Refuser" sur chaque ligne en attente, visibles uniquement si
  l'utilisateur courant est organisateur (`myRole`)
- Navigation depuis la carte `/seasons` vers `/seasons/:id`

## Conditions d'acceptation

1. **Étant donné** un organisateur de la saison, **quand** il ouvre `/seasons/:id`,
   **alors** il voit la liste des participants validés et la liste des demandes en
   attente, chacune avec le nom de l'utilisateur et de l'équipe proposée.
2. **Étant donné** un participant non-organisateur (`VALIDATED`), **quand** il
   ouvre `/seasons/:id`, **alors** il voit les mêmes listes mais sans les boutons
   Valider/Refuser.
3. **Étant donné** un utilisateur sans `SeasonParticipant` `VALIDATED` pour cette
   saison, **quand** il accède à `/api/seasons/:id` ou `/seasons/:id`, **alors** une
   erreur 404 est retournée / une page d'erreur générique est affichée (pas de fuite
   d'information).
4. **Étant donné** une demande `PENDING`, **quand** l'organisateur clique sur
   "Valider", **alors** son `status` passe à `VALIDATED` et elle apparaît dans la
   liste des participants validés sans rechargement de page (mise à jour via
   signal).
5. **Étant donné** une demande `PENDING`, **quand** l'organisateur clique sur
   "Refuser", **alors** son `status` passe à `REJECTED` et elle disparaît de la
   liste "En attente".
6. **Étant donné** un utilisateur dont la demande est passée `VALIDATED`,
   **alors** sa saison apparaît dans `/seasons` avec le badge "🏎️ Participant" et
   le nom de son équipe.
7. **Étant donné** un utilisateur non-organisateur, **quand** il appelle directement
   `PUT /api/seasons/:id/participants/:pid/validate`, **alors** la requête échoue
   (404).
