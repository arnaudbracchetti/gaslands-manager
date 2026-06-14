# US6 — Retirer un participant

> Référence : [2026-06-14-saisons-design.md](../2026-06-14-saisons-design.md)
> Dépend de : [US3](us3-valider-refuser-les-inscriptions.md)

## Description

Un organisateur peut retirer un participant (validé ou en attente) d'une saison,
tant que celle-ci est encore `EN_CONSTRUCTION`.

## Périmètre

**Backend**
- `SeasonParticipantService.remove(seasonId, pid, organizerUserId)` :
  - vérifie que l'appelant est organisateur (`assertOrganizer`)
  - rejette si la saison n'est pas `EN_CONSTRUCTION`
  - rejette si la cible est le dernier organisateur de la saison (cf. garde-fou
    §4 du design — éviter une saison orpheline)
  - supprime la ligne `SeasonParticipant` (cascade sur `GameParticipant` si
    applicable, cf. US8)
- Route : `DELETE /api/seasons/:id/participants/:pid`

**Frontend**
- Bouton "Retirer" sur chaque ligne de `participant-list/`, visible uniquement par
  les organisateurs et uniquement si `season.state === 'EN_CONSTRUCTION'`
- Confirmation (`window.confirm`, pattern existant pour les suppressions) avant
  l'appel API
- Retrait de la ligne de la liste après succès

## Conditions d'acceptation

1. **Étant donné** une saison `EN_CONSTRUCTION` et un participant `VALIDATED`
   non-organisateur, **quand** l'organisateur confirme "Retirer", **alors** la
   ligne `SeasonParticipant` est supprimée et disparaît de la liste.
2. **Étant donné** une saison `EN_CONSTRUCTION` et une demande `PENDING`,
   **quand** l'organisateur clique "Retirer" sur cette ligne, **alors** la demande
   est supprimée (alternative au refus, même résultat visible).
3. **Étant donné** une saison dont l'état n'est plus `EN_CONSTRUCTION`, **alors**
   le bouton "Retirer" n'est pas affiché, et un appel direct à
   `DELETE /api/seasons/:id/participants/:pid` échoue avec un message explicite.
4. **Étant donné** une saison avec un seul organisateur, **quand** celui-ci tente
   de se retirer lui-même, **alors** l'opération est rejetée (saison orpheline
   évitée).
5. **Étant donné** une saison avec deux organisateurs, **quand** l'un retire
   l'autre (ou se retire lui-même), **alors** l'opération réussit — il reste au
   moins un organisateur.
6. **Étant donné** un utilisateur non-organisateur, **quand** il appelle
   directement `DELETE /api/seasons/:id/participants/:pid`, **alors** la requête
   échoue (404).
