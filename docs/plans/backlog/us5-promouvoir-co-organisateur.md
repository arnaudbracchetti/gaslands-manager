# US5 — Promouvoir un co-organisateur

> Référence : [2026-06-14-saisons-design.md](../2026-06-14-saisons-design.md)
> Dépend de : [US3](us3-valider-refuser-les-inscriptions.md)

## Description

Un organisateur peut promouvoir un participant validé au rang de co-organisateur,
lui donnant les mêmes droits de gestion sur la saison.

## Périmètre

**Backend**
- `SeasonParticipantService.promote(seasonId, pid, organizerUserId)` :
  - vérifie que l'appelant est organisateur (`assertOrganizer`)
  - vérifie que la cible a `status: VALIDATED`
  - passe `isOrganizer` à `true` sur la cible
- Route : `PUT /api/seasons/:id/participants/:pid/promote`

**Frontend**
- Bouton "Promouvoir" sur chaque ligne de participant validé non-organisateur,
  dans `participant-list/`, visible uniquement par les organisateurs
- Mise à jour de l'affichage (badge "🏆 Organisateur") après promotion, sans
  rechargement de page

## Conditions d'acceptation

1. **Étant donné** un participant `VALIDATED` non-organisateur, **quand** un
   organisateur clique sur "Promouvoir" sur sa ligne, **alors** son
   `isOrganizer` passe à `true` et le badge "🏆 Organisateur" apparaît sur sa
   ligne.
2. **Étant donné** un participant nouvellement promu, **quand** il ouvre
   `/seasons/:id`, **alors** il voit les boutons Valider/Refuser/Promouvoir/Retirer
   (mêmes droits que le créateur).
3. **Étant donné** un participant déjà organisateur, **alors** le bouton
   "Promouvoir" n'est pas affiché sur sa ligne (ou est désactivé).
4. **Étant donné** un utilisateur non-organisateur, **quand** il appelle
   directement `PUT /api/seasons/:id/participants/:pid/promote`, **alors** la
   requête échoue (404).
5. **Étant donné** un participant avec `status: PENDING`, **alors** la promotion
   est rejetée (impossible de promouvoir un participant non encore validé).
