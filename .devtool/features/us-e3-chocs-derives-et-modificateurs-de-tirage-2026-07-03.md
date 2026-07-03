---
id: "us-e3-chocs-derives-et-modificateurs-de-tirage-2026-07-03"
status: "backlog"
priority: "medium"
assignee: null
dueDate: null
created: "2026-07-03T19:28:55.333Z"
modified: "2026-07-03T19:41:13.716Z"
completedAt: null
labels: ["mode-campagne", "degats-sequelles"]
order: "a8"
---

# Chocs dérivés et modificateurs de tirage

En tant que joueur, je veux que les Chocs cumulés et les Séquelles spéciales
influencent correctement les futurs tirages, afin que la mécanique du livre soit
respectée.

## Critères d'acceptation

- [x] Étant donné un véhicule, quand je consulte ses Chocs, alors ils sont dérivés
      (Σ chocs gagnés − Σ coût des séquelles), jamais stockés en colonne.
- [ ] Étant donné un véhicule avec « Maintenu par la Rouille », quand il devient
      Épave, alors le résolveur applique deux lancers au lieu d'un (p.169).
- [ ] Étant donné un véhicule avec « Légende Vivante », quand il devient Épave,
      alors le résolveur force le résultat à « 1 » avant application (p.169).
- [ ] Étant donné une Séquelle de pure règle de table (Vibrations, Suicidaire…),
      quand elle est présente, alors elle est affichée en rappel mais n'altère
      aucun calcul de l'appli.

## Vérification code (2026-07-03)

Repassée de `done` à `backlog` : la formule de Chocs dérivés est bien implémentée
(`Vehicle._chocs`, champ transient recalculé au replay via `addChocs()`), mais
**aucun des modificateurs spéciaux liés aux séquelles n'existe** :
- « Maintenu par la Rouille » et « Légende Vivante » : ces noms n'apparaissent nulle
  part dans le code (`grep -rniE "rouille|légende vivante"` → aucun résultat). Le
  résolveur (`WreckResolverService.resolve()`) ne lit que `vehicle.type.poids` et
  `vehicle.chocs` — il ne consulte jamais `vehicle.sequellas`, donc aucun
  branchement spécial par séquelle n'est structurellement possible aujourd'hui.
- Le registre `SEQUELLA_REGISTRY` ne contient que 3 entrées
  (`moteur_endommage`, `direction_endommage`, `blindage_arrache`), toutes des
  altérations de statistiques — aucune catégorie « affichage seul / pure règle de
  table » n'existe dans `SequellaType`.
