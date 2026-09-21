---
id: "rm-2-catalogue-yaml-regles-maison-2026-09-20"
status: "todo"
priority: "medium"
assignee: null
dueDate: null
created: "2026-09-20T10:02:28.000Z"
modified: "2026-09-21T17:49:48.000Z"
completedAt: null
labels: ["regles-maison", "mode-campagne", "wayfinder:task"]
order: "aY"
---
# RM-2 — Catalogue YAML des règles maison

Carte parente : [Carte — Règles maison](./regles-maison-carte-2026-09-20.md)

## Question

Créer le catalogue de définitions des règles maison et son exposition en lecture
publique, sur le modèle des catalogues déjà en place (sponsors, véhicules, armes,
améliorations, avantages, séquelles, scénarios).

## Critères d'acceptation

- [ ] Fichier `database_init/data/regles-maison.yml`, chaque règle portant : nom
      affiché, nom interne, description courte « décochée » (rappel du
      comportement par défaut) et description courte « cochée » (comportement
      alternatif).
- [ ] Chargement au démarrage en singleton mémoire, indexé par nom interne,
      conversion Markdown → HTML des textes — même mécanisme que les catalogues
      existants, patron Template Method compris pour rendre le service testable
      sans simuler le système de fichiers.
- [ ] Endpoint public (sans JWT), aligné sur les autres routes de catalogue.
- [ ] Première entrée : `resistance_sans_points_championnat`, libellée
      « Points de Résistance aux équipes sans point de championnat ».
- [ ] Textes courts de cette première règle :
      décochée — « Les participants classés dans la seconde moitié du classement
      gagnent 3 Points de Résistance. » ;
      cochée — « Les participants qui n'ont gagné aucun point de championnat sur
      la partie gagnent 3 Points de Résistance. »
- [ ] Tests unitaires du service de chargement.

## Notes

Pas de champ de règles détaillées : écarté au cadrage (cf. *Out of scope* de la
carte parente), il serait de la donnée morte tant qu'aucun écran ne l'affiche.

## Dépendances

Bloquait sur [RM-1](./done/rm-1-conception-ddd-regles-maison-2026-09-20.md) — **résolu**.
Conception retenue (§2 du document de conception, cf. résolution RM-1) : service
singleton dédié dans `campaign/`, calqué fichier pour fichier sur
`ScenarioCatalogService` — pas une extension du `CatalogService` du module équipe.
Détail complet :
[docs/plans/2026-09-21-regles-maison-mecanisme-design.md](../../docs/plans/2026-09-21-regles-maison-mecanisme-design.md#2-catalogue-yaml-des-règles-maison).
