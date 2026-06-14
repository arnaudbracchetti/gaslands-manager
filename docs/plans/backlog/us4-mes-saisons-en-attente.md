# US4 — Mes saisons en attente (vues "pending")

> Référence : [2026-06-14-saisons-design.md](../2026-06-14-saisons-design.md)
> Dépend de : [US3](us3-valider-refuser-les-inscriptions.md)

## Description

Sur la page `/seasons`, un utilisateur voit immédiatement (1) ses propres demandes
d'inscription en attente de validation et (2) — s'il est organisateur — le nombre de
demandes en attente dans les saisons qu'il organise, sans avoir à ouvrir chaque
saison.

## Périmètre

**Backend**
- `SeasonService.findPendingForUser(userId)` : saisons où l'utilisateur a un
  `SeasonParticipant` avec `status: PENDING`
- `SeasonService.findOrganizedWithPendingRequests(userId)` : pour chaque saison où
  l'utilisateur est `isOrganizer: true, status: VALIDATED`, compte les
  `SeasonParticipant` avec `status: PENDING` (autres que les siens)
- Routes : `GET /api/seasons/pending`, `GET /api/seasons/organizing/pending-requests`
- `SeasonResponseDto` enrichi (ou DTO dédié) : champ `pendingRequestsCount` pour les
  saisons organisées

**Frontend**
- `Seasons` (smart) : appelle les deux nouvelles routes en plus de `GET /api/seasons`
- `season-card/` : badge "⏳ En attente de validation" si l'utilisateur a une
  demande `PENDING` pour cette saison ; badge "⚠️ N à valider" si
  `pendingRequestsCount > 0` et l'utilisateur est organisateur

## Conditions d'acceptation

1. **Étant donné** un utilisateur ayant soumis une demande d'inscription non encore
   traitée, **quand** il ouvre `/seasons`, **alors** la carte de cette saison affiche
   le badge "⏳ En attente de validation".
2. **Étant donné** un organisateur ayant 2 demandes `PENDING` sur sa saison,
   **quand** il ouvre `/seasons`, **alors** la carte affiche "⚠️ 2 à valider".
3. **Étant donné** une saison sans aucune demande `PENDING`, **alors** aucun badge
   d'alerte n'est affiché sur sa carte.
4. **Étant donné** une demande validée ou refusée (US3), **quand** l'utilisateur
   recharge `/seasons`, **alors** le badge "⏳ En attente" correspondant disparaît
   (et le badge de rôle approprié — Organisateur/Participant — s'affiche à la
   place).
5. **Étant donné** un utilisateur n'étant organisateur d'aucune saison, **alors**
   `GET /api/seasons/organizing/pending-requests` retourne une liste vide (pas
   d'erreur).
