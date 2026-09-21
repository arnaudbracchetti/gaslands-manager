---
id: "rm-8-documentation-regles-maison-2026-09-20"
status: "backlog"
priority: "medium"
assignee: null
dueDate: null
created: "2026-09-20T10:02:28.000Z"
modified: "2026-09-20T10:02:28.000Z"
completedAt: null
labels: ["regles-maison", "mode-campagne", "documentation", "wayfinder:task"]
order: "ae"
---
# RM-8 — Documentation des règles maison

Carte parente : [Carte — Règles maison](./regles-maison-carte-2026-09-20.md)

## Question

Mettre la documentation au niveau de ce qui a été livré.

## Critères d'acceptation

- [ ] `docs/spec/CAMPAIGN.md` : section « Règles maison » — mécanisme, portée par
      campagne, qui règle et quand, gel du calcul à la clôture de la partie, et la
      règle R1 elle-même. Mettre aussi à jour la section Points de Résistance,
      dont le moment de calcul a changé.
- [ ] `docs/DOMAIN_MODEL.md` : le réglage sur l'agrégat campagne, la nouvelle
      Strategy, le catalogue de règles maison dans le diagramme des catalogues.
- [ ] `docs/COMPONENTS.md` : les composants ajoutés ou modifiés en RM-6 et RM-7.
- [ ] `docs/ARCHITECTURE.md` : le nouveau service de catalogue, s'il en est créé
      un, et le point d'exécution déplacé de la distribution des PR.
- [ ] `content/docs/campagnes.md` (documentation **utilisateur**) : une section
      expliquant le **mécanisme** — à quoi servent les règles maison, qui les
      active, quand, et le fait qu'une partie déjà jouée n'est jamais recalculée.
      La liste des règles reste portée par le catalogue et affichée à l'écran,
      jamais recopiée ici (une seule source à maintenir).
- [ ] `docs/SPECIFICATION.md` : tableau de suivi des fonctionnalités mis à jour.

## Dépendances

Bloqué par [RM-5](./rm-5-strategie-pr-sans-point-championnat-2026-09-20.md),
[RM-6](./rm-6-ihm-reglage-regles-maison-2026-09-20.md) et
[RM-7](./rm-7-ihm-affichage-lecture-seule-2026-09-20.md) — la documentation décrit
ce qui a effectivement été livré.
