---
id: "rm-6-ihm-reglage-regles-maison-2026-09-20"
status: "todo"
priority: "medium"
assignee: null
dueDate: null
created: "2026-09-20T10:02:28.000Z"
modified: "2026-09-23T20:57:32.000Z"
completedAt: null
labels: ["regles-maison", "mode-campagne", "frontend", "wayfinder:task"]
order: "ac"
---
# RM-6 — IHM : régler les règles maison d'une campagne

Carte parente : [Carte — Règles maison](./regles-maison-carte-2026-09-20.md)

## Question

Permettre à l'organisateur d'activer ou désactiver chaque règle maison, à la
création de la campagne et après coup.

## Critères d'acceptation

- [ ] Un composant de liste alimenté par le catalogue : une case à cocher par
      règle, avec son nom.
- [ ] Sous chaque case, **une seule ligne courte, qui change selon l'état de la
      case** — cochée : le comportement alternatif ; décochée : le rappel du
      comportement par défaut. Bascule immédiate au clic, de sorte que
      l'utilisateur découvre l'autre comportement en cochant/décochant.
- [ ] Intégré au formulaire de création de campagne **et** à la modale d'édition.
      Attention : cette dernière est déjà une modale — tout reste en ligne, pas de
      modale imbriquée ni d'écran de détail.
- [ ] Aucune règle codée en dur côté frontend : ajouter une entrée au catalogue
      suffit à la faire apparaître.
- [ ] Mode zoneless : tout changement d'état passe par des Signals.
- [ ] Tests unitaires du composant.

## Dépendances

Bloqué par [RM-2](./done/rm-2-catalogue-yaml-regles-maison-2026-09-20.md) — le
catalogue alimente la liste — et
[RM-3](./done/rm-3-persistance-houserules-campagne-2026-09-20.md) — le réglage doit
être persistable. **Les deux sont résolues — prenable.**
