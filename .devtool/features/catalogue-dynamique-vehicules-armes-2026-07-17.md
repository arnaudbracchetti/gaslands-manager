---
id: "catalogue-dynamique-vehicules-armes-2026-07-17"
status: "backlog"
priority: "medium"
assignee: null
dueDate: null
created: "2026-07-17T00:00:00.000Z"
modified: "2026-07-17T00:00:00.000Z"
completedAt: null
labels: ["frontend", "catalogue"]
order: "aF"
---

# Catalogue dynamique `/vehicles` et `/weapons`

En tant que joueur, je veux consulter le catalogue complet des véhicules et armes
disponibles, filtrables par sponsor, afin de préparer mes équipes et comprendre
l'économie du jeu.

## Critères d'acceptation

- [ ] Étant donné la page `/vehicles`, quand je la consulte, alors j'ai accès à
      `GET /api/catalog/vehicules` avec une liste complète de tous les véhicules,
      triés par poids ou sponsor.
- [ ] Étant donné un sponsor sélectionné, quand j'applique le filtre, alors la
      liste n'affiche que les véhicules autorisés par ce sponsor (relation
      `sponsors_autorises` du catalogue).
- [ ] Étant donné un véhicule, quand je clique dessus, alors une modale ou page
      affiche ses statistiques complètes (carrosserie, manoeuvrabilité, vitesse,
      équipage, emplacements, prix, description, règles).
- [ ] Étant donné la page `/weapons`, quand je la consulte, alors j'ai accès
      `GET /api/catalog/armes` avec la même mécanique de filtre par sponsor.

## Notes

Backlog déclaré dans `docs/spec/NAVIGATION.md` — actuellement des pages
placeholder. Réutiliser les composants existants (`EquipmentOption`,
`EquipmentDetailModal` du configurateur) ou en créer des variantes dedicate.
