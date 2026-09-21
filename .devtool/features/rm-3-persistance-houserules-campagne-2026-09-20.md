---
id: "rm-3-persistance-houserules-campagne-2026-09-20"
status: "backlog"
priority: "medium"
assignee: null
dueDate: null
created: "2026-09-20T10:02:28.000Z"
modified: "2026-09-20T10:02:28.000Z"
completedAt: null
labels: ["regles-maison", "mode-campagne", "wayfinder:task"]
order: "aZ"
---
# RM-3 — Persistance du réglage des règles maison sur la campagne

Carte parente : [Carte — Règles maison](./regles-maison-carte-2026-09-20.md)

## Question

Stocker et exposer, par campagne, l'état des règles maison — sur le modèle de
bout en bout déjà en place pour le budget de campagne.

## Critères d'acceptation

- [ ] Colonne sur l'entité campagne, champ correspondant dans l'agrégat avec son
      accesseur, hydratation par le mapper.
- [ ] Mutation portée par l'agrégat, **sans contrainte d'état** : modifiable en
      construction, en cours et jusqu'à la fin — contrairement au budget, dont la
      restriction `EN_CONSTRUCTION` tient à l'éligibilité des équipes, sans objet
      ici.
- [ ] Une clé absente du catalogue est rejetée en HTTP 400, jamais ignorée
      silencieusement.
- [ ] Réglable à la création de la campagne **et** à sa modification.
- [ ] Exposé dans les réponses de campagne, y compris sur la route de consultation
      par code d'invitation — l'écran d'inscription en a besoin (cf. RM-7).
- [ ] Migration de production, conformément à la procédure du projet.
- [ ] Tests unitaires : agrégat (mutation, rejet d'une clé inconnue) et use cases.

## Dépendances

Bloqué par [RM-1](./rm-1-conception-ddd-regles-maison-2026-09-20.md) (forme du
stockage) et [RM-2](./rm-2-catalogue-yaml-regles-maison-2026-09-20.md) — le
catalogue est la référence contre laquelle les clés sont validées.
