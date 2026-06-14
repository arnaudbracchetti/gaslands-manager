# US7 — Transition d'état de la saison

> Référence : [2026-06-14-saisons-design.md](../2026-06-14-saisons-design.md)
> Dépend de : [US3](us3-valider-refuser-les-inscriptions.md)

## Description

Un organisateur fait progresser la saison dans son cycle de vie
(`EN_CONSTRUCTION` → `EN_COURS` → `TERMINEE`), ce qui verrouille ou déverrouille
les inscriptions.

## Périmètre

**Backend**
- `SeasonService.transitionState(id, userId, newState)` :
  - vérifie que l'appelant est organisateur (`assertOrganizer`)
  - n'autorise que les transitions séquentielles
    (`EN_CONSTRUCTION → EN_COURS`, `EN_COURS → TERMINEE`) — rejette toute autre
    combinaison (retour en arrière, saut d'état)
  - lors du passage à `EN_COURS` : positionne `isLocked: true` sur tous les
    `SeasonParticipant` `VALIDATED` de la saison
  - lors du passage à `TERMINEE` : repositionne `isLocked: false` sur tous les
    `SeasonParticipant` de la saison
- Route : `PUT /api/seasons/:id/state` (body : `{ state: SeasonState }`)

**Frontend**
- Bandeau d'état en tête de `/seasons/:id` (badge `EN_CONSTRUCTION` /
  `EN_COURS` / `TERMINEE`)
- Bouton de transition contextuel ("Passer en EN_COURS" / "Terminer la saison"),
  visible uniquement par les organisateurs, absent si la saison est `TERMINEE`
- Masquage des actions d'inscription (US2 : "Rejoindre via code") une fois la
  saison hors `EN_CONSTRUCTION`
- Masquage des boutons Valider/Refuser/Promouvoir/Retirer (US3/US5/US6) une fois
  hors `EN_CONSTRUCTION`

## Conditions d'acceptation

1. **Étant donné** une saison `EN_CONSTRUCTION`, **quand** un organisateur clique
   sur "Passer en EN_COURS", **alors** `season.state` devient `EN_COURS` et tous
   les `SeasonParticipant` `VALIDATED` ont `isLocked: true`.
2. **Étant donné** une saison `EN_COURS`, **alors** les actions d'inscription
   (rejoindre, valider, refuser, promouvoir, retirer) ne sont plus disponibles
   dans l'UI, et les appels API correspondants sont rejetés.
3. **Étant donné** une saison `EN_COURS`, **quand** un organisateur clique sur
   "Terminer la saison", **alors** `season.state` devient `TERMINEE` et tous les
   `SeasonParticipant` ont `isLocked: false`.
4. **Étant donné** une saison `EN_CONSTRUCTION`, **quand** une requête tente de la
   faire passer directement à `TERMINEE`, **alors** la requête est rejetée
   (transition non séquentielle).
5. **Étant donné** une saison `TERMINEE`, **alors** aucun bouton de transition
   n'est affiché, et toute tentative de changement d'état est rejetée.
6. **Étant donné** un utilisateur non-organisateur, **quand** il appelle
   directement `PUT /api/seasons/:id/state`, **alors** la requête échoue (404).
