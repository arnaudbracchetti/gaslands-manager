---
id: "rm-4-deplacer-distribution-pr-entree-atelier-2026-09-20"
status: "done"
priority: "high"
assignee: null
dueDate: null
created: "2026-09-20T10:02:28.000Z"
modified: "2026-09-21T18:54:25.989Z"
completedAt: "2026-09-21T18:54:25.989Z"
labels: ["regles-maison", "mode-campagne", "wayfinder:task"]
order: "aa"
---
# RM-4 — Déplacer la distribution des Points de Résistance vers l'entrée en Atelier

Carte parente : [Carte — Règles maison](./regles-maison-carte-2026-09-20.md)

## Question

Refactor **à comportement constant**, avant l'introduction de la moindre règle
maison : la distribution automatique des Points de Résistance quitte
l'enregistrement du résultat pour se faire à l'entrée en Atelier, dernier geste du
wizard de fin de partie.

**Pourquoi** : le total de points de championnat d'une partie n'est pas complet au
moment de l'enregistrement du résultat — le bonus Favori du Public est émis plus
tard, à l'écran de résolution. Le critère de la future règle maison (« aucun point
de championnat sur la partie ») serait donc faux dans ce cas précis.

## Critères d'acceptation

- [x] L'émission des événements de Résistance est retirée de l'enregistrement du
      résultat.
- [x] Nouvelle méthode `Game.distributeResistance(strategy)` — **pas** ajoutée à
      `Campaign.enterAtelier` (qui reste inchangée, un concept par méthode) —
      construite en lisant le journal déjà constitué de la partie (le rang de
      chaque participant y figure) ; `EnterAtelierUseCase` l'appelle et persiste
      ses événements **avant** de persister la transition de statut.
- [x] **Garde de type de partie** : hook polymorphe (liste vide par défaut sur
      `Game`, surchargée par `EvenementTeleGame`) — pas un test de type. L'entrée
      en Atelier concerne aussi les Escarmouches, qui ne distribuent jamais de
      Points de Résistance.
- [x] **Colonne marqueur** `resistanceStrategyKey` (nullable) sur `GameEventOrm` —
      posée dès cette carte, valeur réservée `"defaut"` (non cataloguée, RM-5
      ajoutera une seconde valeur sans nouvelle migration).
- [x] **Garde d'idempotence** : si le journal porte déjà un événement marqué
      (`resistanceStrategyKey` non nul), la (re)distribution est sautée
      silencieusement et la transition de statut se fait quand même — rattrape un
      rejeu après échec de la persistance du statut (aucune transaction n'existe
      dans le projet).
- [x] La route manuelle de contact Résistance n'est pas touchée.
- [x] Tests existants adaptés + nouveaux tests sur `EnterAtelierUseCase` (aucun
      test dédié aujourd'hui) couvrant la garde d'idempotence et l'ordre de
      persistance. À l'issue de cette carte, le comportement observable est
      **identique** à aujourd'hui, au moment d'écriture près.

## Notes

Deux effets attendus et acceptés :

- les lignes de contact Résistance apparaissent désormais en fin de journal de
  partie, après les tirages d'épave, au lieu d'être intercalées avec le classement ;
- un wizard abandonné en cours de route ne crédite plus rien du tout — c'est une
  amélioration par rapport à aujourd'hui, où les points sont déjà écrits dès la
  soumission des résultats.

C'est le refactor signalé comme risque au cadrage, et assumé : il touche la règle
par défaut, qui fonctionne aujourd'hui. D'où son isolement dans une carte dédiée,
sans changement de comportement, avant l'ajout de la règle maison en RM-5.

## Dépendances

Bloquait sur [RM-1](./rm-1-conception-ddd-regles-maison-2026-09-20.md) — **résolu**.
Conception retenue (§4 à §7 du document de conception, cf. résolution RM-1) : le
changement de statut et l'écriture d'événements ne sont **pas** composés dans un
même geste — deux méthodes séparées (`Campaign.enterAtelier` inchangée,
`Game.distributeResistance` nouvelle), orchestrées par `EnterAtelierUseCase` qui
persiste le journal avant le statut. Détail complet :
[docs/plans/2026-09-21-regles-maison-mecanisme-design.md](../../../docs/plans/2026-09-21-regles-maison-mecanisme-design.md#6-deux-méthodes-deux-concepts--orchestrées-par-le-use-case).

## Résolution

Implémenté à l'identique de la conception retenue lors de RM-1 (§4 à §7) :

- **`Game.distributeResistance(strategy)`** (`domain/games/game.ts`) — no-op par
  défaut (retourne `[]`), documenté comme hook polymorphe. Le paramètre est typé
  `ResistanceDistributionStrategy` (nouveau fichier
  `domain/resistance-distribution-strategy.ts`, avec l'interface
  `ResistanceEntry`/`ResistanceDistributionStrategy` et une seule implémentation,
  `DefaultResistanceStrategy` — `key = "defaut"`, critère `rank > classified`,
  extrait tel quel de l'ancien `Game.recordResult`).
- **`EvenementTeleGame.distributeResistance`** — override portant la garde
  d'idempotence (recherche d'un `ResistanceContactedEvent` déjà marqué), le relevé
  des `RankingAssignedEvent` de la partie (`classified = ceil(n/2)`), et la boucle
  qui interroge la Strategy par participant. `EscarmoucheGame` hérite du no-op sans
  rien surcharger.
- **Accesseur polymorphe `GameEvent.championshipPointsAwarded`** (défaut `0`),
  surchargé par les 4 événements qui appellent `addPoints()`
  (`RankingAssignedEvent`, `GatesCrossedEvent`, `VehicleDestroyedEvent`,
  `FavoriDuPublicBonusEvent`) — utilisé pour construire `championshipPointsThisGame`
  sur chaque `ResistanceEntry`, prêt pour la Strategy R1 de RM-5 (la règle par
  défaut ne le consomme pas, seulement le rang).
- **`ResistanceContactedEvent`** gagne un champ `strategyKey: string | null`
  (défaut `null`) — non-null pour un contact automatique, toujours `null` pour la
  route manuelle (`Game.contactResistance`, non touchée).
- **`Game.recordResult`** ne journalise plus de `ResistanceContactedEvent` — le
  bloc correspondant et sa mention dans la docstring sont retirés.
- **`EnterAtelierUseCase`** orchestre les deux concepts dans un seul essai/catch
  (validation en mémoire de `findGame`/`distributeResistance`/`enterAtelier` avant
  toute écriture), puis persiste le journal de distribution (`appendEvents`,
  seulement si non vide) **avant** `saveCampaign` — jamais l'inverse.
- **Persistance** : colonne `resistanceStrategyKey` (varchar nullable) ajoutée à
  `GameEventOrm`, au mapper (`campaign.mapper.ts`) et au repository
  (`campaign.repository.ts`, `eventToOrm`) ; migration dédiée
  `1790016140741-AddResistanceStrategyKey` (enregistrée dans
  `migrations/index.ts`).
- **Tests** : `game.spec.ts` (test `recordResult` adapté à 2 événements au lieu de
  3 ; nouveau describe `Game — distributeResistance` — nominal, aucun PR si tout le
  monde classé, indépendance du critère vis-à-vis des PC d'exploit, idempotence,
  contact manuel préexistant sans effet sur la garde, no-op Escarmouche),
  `resistance-contacted.event.spec.ts` (valeur par défaut/fournie de
  `strategyKey`), et nouveau fichier `enter-atelier.usecase.spec.ts` (distribution
  + ordre de persistance, idempotence + statut quand même basculé, no-op
  Escarmouche, échec AVANT toute persistance si la partie n'est pas `PLANIFIE`,
  rejet d'un appelant non organisateur).

Suite complète backend verte (954 tests, aucune régression), build webpack
réussi, lint propre sur tout le code nouveau (les erreurs `typedef` restantes sur
les fichiers touchés sont préexistantes — même motif que `readonly eventType = …`
déjà présent sur tous les autres événements). Documentation mise à jour :
[spec/CAMPAIGN.md](../../../docs/spec/CAMPAIGN.md#points-de-résistance-mécanique-secrète)
(limitation US-F1), [ARCHITECTURE.md §3.8](../../../docs/ARCHITECTURE.md#38-mode-campagne--event-sourcing-campaign)
(flux `EnterAtelierUseCase`, table des fichiers clés), et
[DOMAIN_MODEL.md §4](../../../docs/DOMAIN_MODEL.md) (ERD, diagramme de classe `Game`,
table des événements, répartition Campaign/Game).

RM-5 reste en `backlog` : elle dépend aussi de RM-3, pas encore résolue.
