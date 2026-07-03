---
id: "us-d2-recevoir-les-recompenses-dune-partie-2026-07-03"
status: "backlog"
priority: "high"
assignee: null
dueDate: null
created: "2026-07-03T19:28:55.333Z"
modified: "2026-07-03T19:41:13.716Z"
completedAt: null
labels: ["mode-campagne", "cagnotte-atelier"]
order: "a3"
---

# Recevoir les récompenses d'une partie

En tant que joueur, je veux que les jerricans gagnés lors d'une partie créditent
automatiquement ma cagnotte, afin de financer mes prochains achats.

## Critères d'acceptation

- [ ] Étant donné une partie validée rapportant des jerricans à mon équipe, quand
      elle est enregistrée, alors un mouvement de cagnotte RECOMPENSE positif est
      créé automatiquement.
- [ ] Étant donné cette récompense, quand je consulte ma cagnotte, alors elle est
      augmentée du montant correspondant.

## Vérification code (2026-07-03)

Repassée de `done` à `backlog` : non implémenté. `Campaign.recordResult()` ne crée
que des `RankingAssignedEvent` (Points de Championnat) — aucun `WalletMovementEvent`
n'est créé lors de l'enregistrement d'un résultat. `RecordResultDto` et le
formulaire frontend `GameResultForm` ne portent que `{participantId, rank}`, pas de
champ récompense. Créditer des jerricans exige aujourd'hui un appel manuel séparé à
`POST .../events/wallet`, que le frontend n'invoque jamais.
