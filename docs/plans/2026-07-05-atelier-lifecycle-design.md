# Atelier — cycle de vie de partie plutôt qu'entité fictive

> Sous-document de conception référencé par [`docs/spec/CAMPAIGN.md`](../spec/CAMPAIGN.md#cycle-de-vie-dune-partie-et-phase-atelier).

## Contexte

Le mode campagne modélisait la phase "atelier" (achats/reventes d'équipement,
séquelles) via une entité `AtelierGame`, sous-type de `Game` au même titre que
`EvenementTeleGame`/`EscarmoucheGame`. Cette fausse partie était insérée
automatiquement entre deux vraies parties avec un `order` fractionnaire
(`partie.order + 0.5`) et un statut `OUVERT`/`CLOTURE` en miroir de
`PLANIFIE`/`JOUE`. Trois points ont motivé la refonte :

1. **Fausse partie** — `AtelierGame` héritait de `Game` (ranking, `playedAt`,
   etc.) alors que ce n'est pas une partie jouée.
2. **Ordre fractionnaire** — `order + 0.5` était un hack numérique fragile,
   nécessaire uniquement parce que le replay trie les parties sur ce
   flottant, puis les événements internes de chaque partie triés par
   `eventOrder` (scopé par partie). Sans ce flottant, rien ne positionnait
   les événements d'atelier au bon endroit du replay.
3. **Cycle ouverture/fermeture** — fermer l'ancien atelier et en ouvrir un
   nouveau à chaque finalisation de partie était de la mécanique bookkeeping
   qui n'apportait rien, l'état étant de toute façon recalculé par replay
   complet (`GetWorkshopUseCase` ne se sert jamais de la notion d'atelier).

## Décision

Ajouter un état intermédiaire au cycle de vie des parties **réelles**
elles-mêmes — `PLANIFIE → ATELIER → JOUE` — au lieu d'une entité séparée. La
phase atelier d'une partie est directement rattachée à son propre `gameId`.
Ceci résout le point 2 "gratuitement" : les événements d'atelier héritent du
compteur `eventOrder` déjà scopé par partie, sans toucher au replay ni
inventer une séquence globale. Les points 1 et 3 disparaissent avec la
suppression de la classe `AtelierGame` et de l'automatisme
ouverture/fermeture (remplacé par une clôture manuelle organisateur, avec
garde-fou d'auto-clôture + avertissement si une nouvelle partie entre en
atelier alors qu'une précédente est encore ouverte).

## Règles retenues

- Un seul `Game` en statut `ATELIER` à la fois par campagne. Si une nouvelle
  partie entre en atelier (`enterAtelier`) alors qu'une autre y est déjà,
  l'ancienne est automatiquement clôturée (`ATELIER → JOUE`) — pas de
  blocage dur, l'appelant reçoit l'id de la partie auto-clôturée
  (`autoClosedGameId`) pour afficher un avertissement au frontend.
- Si la campagne passe en `TERMINEE` alors qu'une partie est encore en
  `ATELIER`, elle est clôturée automatiquement (`closeCampaign()`).
- `SequellaAddedEvent` est accepté en `PLANIFIE` (séquelle imposée par la
  Table des Épaves, "Siège irrécupérable") **et** en `ATELIER` (achat
  volontaire via Chocs) — ce n'est pas un événement exclusivement atelier.
- Les endpoints `POST .../events/equipment` et `POST .../events/sequella` ne
  prennent plus `:gameId` : le use case retrouve lui-même l'unique partie en
  `ATELIER` de la campagne.

Détail des changements de domaine, application, infrastructure : voir
l'historique du commit associé (module `campaign/`, notamment
`domain/games/game.ts`, `domain/campaign.ts`, `application/enter-atelier.usecase.ts`,
`application/close-atelier.usecase.ts`).
