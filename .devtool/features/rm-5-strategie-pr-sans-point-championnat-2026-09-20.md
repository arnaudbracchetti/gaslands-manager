---
id: "rm-5-strategie-pr-sans-point-championnat-2026-09-20"
status: "todo"
priority: "medium"
assignee: null
dueDate: null
created: "2026-09-20T10:02:28.000Z"
modified: "2026-09-23T20:57:32.000Z"
completedAt: null
labels: ["regles-maison", "mode-campagne", "wayfinder:task"]
order: "ab"
---
# RM-5 — Règle R1 : stratégie « aucun point de championnat »

Carte parente : [Carte — Règles maison](./regles-maison-carte-2026-09-20.md)

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

- [ ] Le calcul actuel est extrait dans une première implémentation de la
      Strategy — comportement par défaut : les participants classés dans la
      seconde moitié reçoivent 3 Points de Résistance.
- [ ] Seconde implémentation : les participants dont le total de points de
      championnat de la partie vaut zéro reçoivent 3 Points de Résistance. Le
      total additionne classement, portes franchies, véhicules détruits **et**
      bonus Favori du Public — tous déjà journalisés à cet instant.
- [ ] La Strategy est résolue depuis l'état des règles maison de la campagne.
- [ ] Montant inchangé (+3), distribution toujours réservée aux Événements
      Télévisés.
- [ ] La description de l'événement mentionne la règle appliquée, visible au
      journal de partie — sans quoi un joueur comparant deux parties n'a aucun
      moyen de comprendre l'écart, puisque la règle est modifiable en cours de
      campagne.
- [ ] Tests unitaires des deux variantes, dont les cas limites : participant
      classé dernier mais ayant franchi des portes (non éligible sous la règle
      maison), et participant dont les seuls points viennent du bonus Favori du
      Public.

## Dépendances

Bloqué par [RM-3](./done/rm-3-persistance-houserules-campagne-2026-09-20.md) — le
réglage doit exister — et
[RM-4](./done/rm-4-deplacer-distribution-pr-entree-atelier-2026-09-20.md) — le point
d'exécution doit avoir été déplacé. **Les deux sont résolues — prenable.**
