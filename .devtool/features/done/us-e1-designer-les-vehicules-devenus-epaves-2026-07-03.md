---
id: "us-e1-designer-les-vehicules-devenus-epaves-2026-07-03"
status: "done"
priority: "high"
assignee: null
dueDate: null
created: "2026-07-03T19:28:55.333Z"
modified: "2026-07-17T00:00:00.000Z"
completedAt: "2026-07-17T00:00:00.000Z"
labels: ["mode-campagne", "degats-sequelles"]
order: "a6"
---

# Désigner les véhicules devenus Épaves

En tant qu'organisateur, je veux cocher quels véhicules sont devenus Épaves pendant
une partie, afin de déclencher la résolution du Tableau des Épaves.

## Critères d'acceptation

- [x] Étant donné l'étape 3 de l'enregistrement, quand je coche un véhicule comme
      Épave, alors un outcome distinct (`becameWreck = true`) est créé, séparé de
      la résolution elle-même. (Impl. équivalente : `WreckDesignationStep` séparant désignation/résolution)
- [x] Étant donné un véhicule non coché, quand la partie est validée, alors aucune
      résolution d'Épave ne lui est appliquée.

## Vérification code (2026-07-03)

Repassée de `done` à `backlog` : le flux en deux étapes décrit (désignation, puis
résolution) **n'existe pas**. Aucune trace de `becameWreck` dans le code
(`grep -ri becameWreck` : aucun résultat). Deux endpoints distincts et non liés
existent à la place :
- `POST .../events/wreck` (`wreck-resolve.usecase.ts`) : prend directement un
  `vehicleId` et **résout immédiatement** le Tableau des Épaves (lance le D6 et
  applique le résultat en un seul appel atomique) — pas d'étape de désignation
  préalable.
- `POST .../events/vehicle-lost` (`record-vehicle-lost.usecase.ts`) : déclaration
  manuelle de perte, **sans dé**, totalement indépendante. Son propre commentaire
  précise : « La résolution complète de la Table des Épaves (D6 serveur) est
  distincte et sera traitée par WreckResolveUseCase ».

« Cocher un véhicule comme Épave » reviendrait en pratique à appeler directement
`events/wreck` (qui résout tout de suite, pas juste désigne), ce qui ne correspond
pas au modèle Gherkin de la story. À reformuler une fois le flux cible clarifié.

## Vérification code (2026-07-17)

Implémenté via le wizard (commit 2026-07-04, affiné 2026-07-17) — l'écran 5 `WreckDesignationStep` sépare désormais explicitement la **désignation** (Intact / Détruit par / Mis en épave seul) de la **résolution** (écran 6, automatique, lancers D6). L'intention métier est satisfaite même si le champ littéral `becameWreck` n'existe pas — implémentation équivalente via `wreckedVehicles` et le flux deux écrans. Les 2 critères Gherkin correspondent au comportement observé.
