---
id: "tableau-de-bord-utilisateur-2026-07-17"
status: "backlog"
priority: "low"
assignee: null
dueDate: null
created: "2026-07-17T00:00:00.000Z"
modified: "2026-07-17T00:00:00.000Z"
completedAt: null
labels: ["frontend", "teams"]
order: "aG"
---

# Tableau de bord utilisateur

En tant que joueur, je veux avoir un tableau de bord personnalisé affichant un
résumé de mes équipes, campagnes et activités récentes, afin de naviguer rapidement
sans passer par les pages détail.

## Critères d'acceptation

- [ ] Étant donné mon profil connecté, quand je consulte le tableau de bord, alors
      j'ai accès à :
  - Nombre d'équipes / campagnes en cours (badges ou cartes rapides)
  - Dernières campagnes (3-5 plus récentes), triées par mise à jour décroissante
  - Boutons d'accès rapide « Créer une équipe » / « Créer une campagne »
- [ ] Étant donné une équipe sur le tableau de bord, quand je clique dessus, alors
      je suis redirigé vers sa fiche (`/teams/:id/edit`).
- [ ] Étant donné une campagne sur le tableau de bord, quand je clique dessus, alors
      je suis redirigé vers sa fiche (`/campaigns/:id`).

## Notes

Backlog déclaré dans `docs/spec/NAVIGATION.md`. Peut se doubler d'une page
`/home` améliorée (actuellement présentation statique) ou devenir une section
distincte du menu principal.
