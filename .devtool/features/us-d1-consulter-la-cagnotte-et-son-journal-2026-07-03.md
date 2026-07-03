---
id: "us-d1-consulter-la-cagnotte-et-son-journal-2026-07-03"
status: "backlog"
priority: "high"
assignee: null
dueDate: null
created: "2026-07-03T19:28:55.333Z"
modified: "2026-07-03T19:41:13.716Z"
completedAt: null
labels: ["mode-campagne", "cagnotte-atelier"]
order: "a2"
---

# Consulter la cagnotte et son journal

En tant que joueur, je veux voir la cagnotte courante de mon équipe et l'historique
de ses mouvements, afin de savoir de combien je dispose et d'où viennent les
gains/dépenses.

## Critères d'acceptation

- [ ] Étant donné mon équipe en campagne, quand j'ouvre « Mon Atelier », alors la
      cagnotte affichée = Team.cans + Σ des mouvements de cagnotte.
- [ ] Étant donné des transactions, quand je consulte le journal, alors chaque ligne
      montre montant (+/−), raison (RECOMPENSE/ACHAT/REVENTE) et la partie/véhicule
      liés le cas échéant.

## Vérification code (2026-07-03)

Repassée de `done` à `backlog`. Le calcul backend de la cagnotte est correct
(`CampaignParticipant` réhydratée par replay, `GetWorkshopUseCase`), mais :
- **Aucune UI frontend** — recherche `workshop`/`atelier`/`wallet`/`cagnotte`/`cans`
  dans `apps/frontend/src` : zéro résultat hors fichiers `.spec.ts`. « Mon Atelier »
  n'existe nulle part à ouvrir pour un joueur ; `campaigns.service.ts` n'appelle
  jamais `GET /campaigns/:id/workshop`.
- **Pas de journal** — `WorkshopStateDto` n'expose qu'un solde scalaire `wallet`,
  aucune liste de mouvements. `CampaignQueryService` n'a aucune requête d'historique
  de cagnotte (seul `getResults()` existe, pour le classement).
