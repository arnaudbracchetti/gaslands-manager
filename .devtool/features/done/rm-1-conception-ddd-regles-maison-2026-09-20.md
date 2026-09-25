---
id: "rm-1-conception-ddd-regles-maison-2026-09-20"
status: "done"
priority: "high"
assignee: null
dueDate: null
created: "2026-09-20T10:02:28.000Z"
modified: "2026-09-21T17:49:48.000Z"
completedAt: "2026-09-21T17:49:48.000Z"
labels: ["regles-maison", "mode-campagne", "wayfinder:grilling"]
order: "a1"
---
# RM-1 — Conception détaillée du mécanisme de règles maison (DDD)

Carte parente : [Carte — Règles maison](./regles-maison-carte-2026-09-20.md)

## Question

Figer la conception détaillée du mécanisme et la consigner dans un document sous
`docs/plans/` (convention du projet), avant toute ligne de code. Passer par le
skill `ddd`, obligatoire pour toute nouvelle règle métier backend.

Points à trancher :

- **Structure du réglage dans l'agrégat `Campaign`** : Value Object dédié ou map
  « nom → booléen » nue ? Où vit la validation contre le catalogue (agrégat, use
  case, DTO), sachant que le rejet doit ressortir en HTTP 400 ?
- **Clé orpheline** : que faire d'une règle stockée en base sur une campagne alors
  qu'elle a disparu du catalogue ?
- **Signature de l'interface Strategy** : que reçoit-elle, que retourne-t-elle ?
  Les deux variantes lisent le journal de la partie — le rang pour la règle par
  défaut, le total de PC pour la règle maison.
- **Qui résout la Strategy** : le use case, l'agrégat `Campaign`, ou la partie
  elle-même ? Le domaine ne doit dépendre ni de NestJS ni de TypeORM.
- **Composition à l'entrée en Atelier** : ce geste change aujourd'hui le statut de
  la partie (persisté par la sauvegarde de l'agrégat) et devra désormais **aussi**
  écrire des événements (persistés par l'ajout au journal). Comment garantir que
  les deux vont ensemble — transaction, ordre d'écriture, ou réorganisation de la
  persistance ?
- **Garde de type de partie** au nouveau point d'exécution : l'entrée en Atelier
  concerne les deux types de partie, alors que l'enregistrement de résultat
  rejetait déjà les Escarmouches. Sans garde, une Escarmouche se mettrait à
  distribuer des Points de Résistance, ce qu'elle ne fait jamais aujourd'hui.
- **Traçabilité dans le journal** : l'événement de contact Résistance ne porte
  aujourd'hui aucune donnée utile (seulement ses identifiants), et le montant +3
  est une constante de classe. Mentionner la règle appliquée suppose de lui
  ajouter une information — laquelle, comment la persister, comment la relire ?
- **Impact sur l'annulation du wizard** : vérifier ce que devient la collecte des
  événements à supprimer lors d'un reset, une fois la distribution déplacée après
  le point où l'annulation est encore possible.
- **Où vit le catalogue de règles maison** : extension du service de catalogue
  existant, ou nouveau service singleton sur le même modèle ?
- **Colonne JSON et TypeORM** : forme de colonne retenue, comportement en
  développement (schéma synchronisé automatiquement) et en production (migrations
  explicites, liste de migrations à alimenter).

## Résultat attendu

Un document de conception dans `docs/plans/`, lié depuis cette carte, répondant à
chacun des points ci-dessus.

## Dépendances

Aucune — carte de tête, elle débloque toutes les autres.

## Résolution

Conception close via les skills `ddd` + `grilling` (13 questions posées et
tranchées avec l'utilisateur), après exploration complète du code existant.
Document de conception :
[docs/plans/2026-09-21-regles-maison-mecanisme-design.md](../../../docs/plans/2026-09-21-regles-maison-mecanisme-design.md).

Décisions clés :

- **Réglage** : Value Object `HouseRules` (ensemble des clés activées, pas une map
  complète), deux fabriques (`fromPersisted` sans validation / `fromUserInput`
  validée contre une liste de clés passée en paramètre par le use case — le domaine
  ne connaît jamais le catalogue). Colonne `houseRules` (`jsonb NOT NULL DEFAULT
  '[]'` sur `campaigns`) — première colonne JSON du projet. Clé orpheline : lecture
  tolérante, écriture stricte (400).
- **Catalogue** : nouveau service singleton dans `campaign/`, calqué sur
  `ScenarioCatalogService` — pas une extension du `CatalogService` du module équipe.
  `database_init/data/regles-maison.yml`.
- **Traçabilité** : colonne nullable `resistanceStrategyKey` sur `GameEventOrm`,
  portant la clé de la stratégie appliquée (distingue un contact automatique d'un
  contact manuel) — sert à la fois le texte du journal et la garde d'idempotence.
  Montant +3 reste une constante non persistée.
- **Calcul** : `Game.distributeResistance(strategy)` — nouvelle méthode publique,
  garde la boucle et la construction des événements (comme `recordResult`
  aujourd'hui). La Strategy ne répond qu'à une question unitaire par participant
  (`isEligible(entry, context)`), jamais un filtrage en bloc — `Game` calcule
  lui-même `classified` depuis le compte de ses propres `RankingAssignedEvent`.
- **Garde ET/Escarmouche** : hook polymorphe (liste vide par défaut sur `Game`,
  surchargé par `EvenementTeleGame`) — pas de test de type.
- **Entrée en Atelier** : `Campaign.enterAtelier` reste inchangée (un concept, une
  méthode) ; la distribution vit sur `Game.distributeResistance`, orchestrée
  séparément par `EnterAtelierUseCase` — journal persisté avant le statut, garde
  d'idempotence (sauter silencieusement si déjà distribué, basculer le statut quand
  même).
- **Séquencement** : RM-4 pose la colonne marqueur (valeur réservée `"defaut"`, non
  cataloguée), le hook, la garde d'idempotence — comportement observable inchangé.
  RM-5 ajoute la seconde Strategy (R1), le registre de résolution sur `Campaign`, et
  le texte du journal.
- **Annulation du wizard** : aucun changement nécessaire (`resultEventIdsForReset`
  ne filtre déjà par aucun type, gardé par le statut `PLANIFIE`).

Dettes signalées, hors périmètre : le montant `3` existe en trois copies
indépendantes non couplées ; `EnterAtelierUseCase` n'a aujourd'hui aucun test
unitaire dédié.

RM-2 et RM-4 débloquées (`backlog` → `todo`) — leur unique bloquant est levé.
