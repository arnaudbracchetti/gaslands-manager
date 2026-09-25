---
id: "rm-5-strategie-pr-sans-point-championnat-2026-09-20"
status: "done"
priority: "medium"
assignee: null
dueDate: null
created: "2026-09-20T10:02:28.000Z"
modified: "2026-09-24T11:54:32.000Z"
completedAt: "2026-09-24T11:54:32.000Z"
labels: ["regles-maison", "mode-campagne", "wayfinder:task"]
order: "ab"
---
# RM-5 — Règle R1 : stratégie « aucun point de championnat »

Carte parente : [Carte — Règles maison](../regles-maison-carte-2026-09-20.md)

## Question

Introduire la variation de calcul proprement dite, une fois le point d'exécution
déplacé (RM-4) et le réglage disponible (RM-3).

> **⚠️ Amendement du 2026-09-23** — la conception RM-1 (§« Résolution ») prévoyait
> `Campaign.resolveResistanceStrategy()` appelée par `EnterAtelierUseCase`, qui
> passait ensuite la Strategy en paramètre à `game.distributeResistance(strategy)`.
> **Remplacé** : la sélection est interne au domaine, via une `HouseRuleStrategyFactory`
> (Abstract Factory unique pour toutes les règles maison, une méthode `create…Strategy()`
> par point de calcul) attachée à chaque `Game` par `Campaign`.
> `Game.distributeResistance()` s'appelle désormais **sans argument**. Détail :
> amendement du design
> ([docs/plans/2026-09-21-regles-maison-mecanisme-design.md §4](../../docs/plans/2026-09-21-regles-maison-mecanisme-design.md))
> et convention projet
> ([ARCHITECTURE.md §3.4](../../docs/ARCHITECTURE.md#34-architecture-ddd--standard-du-projet)).
> RM-5 implémente `NoChampionshipPointsStrategy` comme une entrée de plus dans le
> registre de `HouseRuleStrategyFactory`, pas dans un registre séparé.

## Critères d'acceptation

- [x] Le calcul actuel est extrait dans une première implémentation de la
      Strategy — comportement par défaut : les participants classés dans la
      seconde moitié reçoivent 3 Points de Résistance.
- [x] Seconde implémentation : les participants dont le total de points de
      championnat de la partie vaut zéro reçoivent 3 Points de Résistance. Le
      total additionne classement, portes franchies, véhicules détruits **et**
      bonus Favori du Public — tous déjà journalisés à cet instant.
- [x] La Strategy est résolue depuis l'état des règles maison de la campagne.
- [x] Montant inchangé (+3), distribution toujours réservée aux Événements
      Télévisés.
- [x] La description de l'événement mentionne la règle appliquée, visible au
      journal de partie — sans quoi un joueur comparant deux parties n'a aucun
      moyen de comprendre l'écart, puisque la règle est modifiable en cours de
      campagne.
- [x] Tests unitaires des deux variantes, dont les cas limites : participant
      classé dernier mais ayant franchi des portes (non éligible sous la règle
      maison), et participant dont les seuls points viennent du bonus Favori du
      Public.

## Dépendances

Bloqué par [RM-3](../done/rm-3-persistance-houserules-campagne-2026-09-20.md) — le
réglage doit exister — et
[RM-4](./rm-4-deplacer-distribution-pr-entree-atelier-2026-09-20.md) — le point
d'exécution doit avoir été déplacé. **Les deux sont résolues — prenable.**

## Résolu 2026-09-24

Le premier critère était déjà acquis via RM-4 (`DefaultResistanceStrategy`), qui a
aussi livré toute la plomberie de sélection (`HouseRuleStrategyFactory`,
`Game.attachContext`/`GameRulesContext`) en avance sur ce que prévoyait la conception
initiale — RM-5 n'a eu qu'à brancher la première vraie règle maison dedans :

- **`NoChampionshipPointsStrategy`** (`domain/house-rules/resistance-distribution-strategy.ts`)
  — `isEligible` vérifie `championshipPointsThisGame === 0`, sans jamais regarder le
  rang (contrairement à `DefaultResistanceStrategy`). Clé
  `resistance_sans_points_championnat`, identique au `nom_interne` du catalogue.
- **Enregistrée** dans `HOUSE_RULE_REGISTRY`
  (`domain/house-rules/house-rule-strategy.factory.ts`), qui n'était encore qu'un
  registre vide avec un commentaire placeholder — remplacé par la vraie entrée. Aucun
  autre changement dans ce fichier : la résolution "aucune règle active → défaut" et la
  garde "deux règles actives sur le même point → `DomainException`" existaient déjà
  (RM-4) et sont désormais exercées par une vraie entrée plutôt qu'à vide.
- **`ResistanceContactedEvent.describe()`** mentionne désormais la règle appliquée —
  y compris pour la règle *par défaut* (pas seulement R1), sans quoi un joueur ne
  pourrait pas distinguer deux parties ayant utilisé des règles différentes. Mapping
  local clé → libellé français (`STRATEGY_KEY_LABELS`), même idiome que
  `WALLET_REASON_LABELS` (`wallet-movement.event.ts`) — le contact manuel
  (`strategyKey: null`) garde son texte inchangé.
- **Tests** : nouveau `resistance-distribution-strategy.spec.ts` (unitaires purs des
  deux Strategy), complément de `house-rule-strategy.factory.spec.ts` (résolution
  réelle via le registre), deux nouveaux tests d'intégration dans `game.spec.ts`
  couvrant précisément les deux cas limites de la carte — et un troisième démontrant
  qu'un participant à 0 PC reste éligible sous R1 quand un autre, également hors du
  top classé, ne l'est plus dès qu'il a marqué ne serait-ce qu'un point d'exploit
  (`Game.computePoints` renvoie 0 pour tout rang au-delà de `classified`, sans repli
  sur la table de points — utile pour construire ces scénarios). Complément dans
  `resistance-contacted.event.spec.ts` pour les deux nouveaux textes de `describe()`.
  Suite backend complète : 996/996 verts.
- **Documentation** : volontairement **non touchée** par cette carte — la section
  complète « Règles maison » de `docs/spec/CAMPAIGN.md` (mécanisme + R1 elle-même) et
  `content/docs/campagnes.md` sont attribuées à **RM-8**, qui reste bloquée par RM-6 et
  RM-7 (l'IHM de réglage) en plus de RM-5 : documenter un réglage qu'aucun joueur ne
  peut encore activer depuis l'écran n'a pas de sens avant que ces deux cartes soient
  résolues.

RM-6 et RM-7 restent prenables (déjà débloquées par RM-3). RM-8 reste bloquée par
RM-6 et RM-7.
