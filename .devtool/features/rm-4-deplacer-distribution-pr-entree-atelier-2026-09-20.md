---
id: "rm-4-deplacer-distribution-pr-entree-atelier-2026-09-20"
status: "todo"
priority: "high"
assignee: null
dueDate: null
created: "2026-09-20T10:02:28.000Z"
modified: "2026-09-21T17:49:48.000Z"
completedAt: null
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

- [ ] L'émission des événements de Résistance est retirée de l'enregistrement du
      résultat.
- [ ] Nouvelle méthode `Game.distributeResistance(strategy)` — **pas** ajoutée à
      `Campaign.enterAtelier` (qui reste inchangée, un concept par méthode) —
      construite en lisant le journal déjà constitué de la partie (le rang de
      chaque participant y figure) ; `EnterAtelierUseCase` l'appelle et persiste
      ses événements **avant** de persister la transition de statut.
- [ ] **Garde de type de partie** : hook polymorphe (liste vide par défaut sur
      `Game`, surchargée par `EvenementTeleGame`) — pas un test de type. L'entrée
      en Atelier concerne aussi les Escarmouches, qui ne distribuent jamais de
      Points de Résistance.
- [ ] **Colonne marqueur** `resistanceStrategyKey` (nullable) sur `GameEventOrm` —
      posée dès cette carte, valeur réservée `"defaut"` (non cataloguée, RM-5
      ajoutera une seconde valeur sans nouvelle migration).
- [ ] **Garde d'idempotence** : si le journal porte déjà un événement marqué
      (`resistanceStrategyKey` non nul), la (re)distribution est sautée
      silencieusement et la transition de statut se fait quand même — rattrape un
      rejeu après échec de la persistance du statut (aucune transaction n'existe
      dans le projet).
- [ ] La route manuelle de contact Résistance n'est pas touchée.
- [ ] Tests existants adaptés + nouveaux tests sur `EnterAtelierUseCase` (aucun
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

Bloquait sur [RM-1](./done/rm-1-conception-ddd-regles-maison-2026-09-20.md) — **résolu**.
Conception retenue (§4 à §7 du document de conception, cf. résolution RM-1) : le
changement de statut et l'écriture d'événements ne sont **pas** composés dans un
même geste — deux méthodes séparées (`Campaign.enterAtelier` inchangée,
`Game.distributeResistance` nouvelle), orchestrées par `EnterAtelierUseCase` qui
persiste le journal avant le statut. Détail complet :
[docs/plans/2026-09-21-regles-maison-mecanisme-design.md](../../docs/plans/2026-09-21-regles-maison-mecanisme-design.md#6-deux-méthodes-deux-concepts--orchestrées-par-le-use-case).
