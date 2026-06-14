# US2 — Rejoindre une saison via code

> Référence : [2026-06-14-saisons-design.md](../2026-06-14-saisons-design.md)
> Dépend de : [US1](us1-creer-une-saison.md)

## Description

Un utilisateur disposant du code d'invitation d'une saison peut consulter ses
informations minimales, choisir l'une de ses équipes et soumettre une demande
d'inscription (statut `PENDING`).

## Périmètre

**Backend**
- `SeasonService.findByInviteCode(code)` : retourne les infos minimales (nom,
  état, nom de l'organisateur) — pas de vérification d'appartenance
- `SeasonParticipantService.requestJoin(seasonId, userId, teamId)` : crée une ligne
  `SeasonParticipant` (`status: PENDING`, `isOrganizer: false`)
  - rejette si la saison n'est pas `EN_CONSTRUCTION`
  - rejette si l'utilisateur a déjà un `SeasonParticipant` pour cette saison
    (contrainte unique `(seasonId, userId)`)
- Routes : `GET /api/seasons/by-code/:code`, `POST /api/seasons/:id/participants`
- DTO : `JoinSeasonDto` (`teamId`)

**Frontend**
- Affichage du code d'invitation sur la carte de saison (visible par l'organisateur
  uniquement) — composant `invite-link/` (affiche le code + bouton copier)
- Champ "Rejoindre via code" sur `/seasons` → navigue vers `/seasons/join/:code`
- Page `/seasons/join/:code` (smart `SeasonJoin`) : affiche nom/organisateur/état de
  la saison (via `GET /api/seasons/by-code/:code`), select d'une équipe de
  l'utilisateur, bouton "Demander à rejoindre"
- `season-participants.service.ts` (méthode `requestJoin`)

## Conditions d'acceptation

1. **Étant donné** un code d'invitation valide, **quand** un utilisateur navigue
   vers `/seasons/join/:code`, **alors** il voit le nom de la saison, son état et
   le nom de l'organisateur.
2. **Étant donné** un code d'invitation invalide/inexistant, **quand** un
   utilisateur navigue vers `/seasons/join/:code`, **alors** un message d'erreur
   clair s'affiche (pas de crash, pas de fuite d'info sur l'existence d'autres
   saisons).
3. **Étant donné** un utilisateur sur `/seasons/join/:code` possédant au moins une
   équipe, **quand** il sélectionne une équipe et confirme, **alors** une ligne
   `SeasonParticipant` est créée avec `status: PENDING`.
4. **Étant donné** une saison dont l'état n'est plus `EN_CONSTRUCTION`, **quand**
   un utilisateur tente de soumettre une demande d'inscription, **alors** la
   demande est rejetée avec un message explicite.
5. **Étant donné** un utilisateur ayant déjà une demande (`PENDING`, `VALIDATED`
   ou `REJECTED`) pour cette saison, **quand** il tente de soumettre une nouvelle
   demande, **alors** la demande est rejetée (contrainte unicité respectée).
6. **Étant donné** une saison dont l'utilisateur est organisateur, **alors** le
   code d'invitation est visible et copiable depuis sa carte sur `/seasons` (ou
   depuis `/seasons/:id` si déjà disponible).
