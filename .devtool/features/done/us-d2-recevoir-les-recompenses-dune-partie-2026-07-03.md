---
id: "us-d2-recevoir-les-recompenses-dune-partie-2026-07-03"
status: "done"
priority: "high"
assignee: null
dueDate: null
created: "2026-07-03T19:28:55.333Z"
modified: "2026-07-17T00:00:00.000Z"
completedAt: "2026-07-17T00:00:00.000Z"
labels: ["mode-campagne", "cagnotte-atelier"]
order: "a3"
---

# Recevoir les récompenses d'une partie

En tant que joueur, je veux que les jerricans gagnés lors d'une partie créditent
automatiquement ma cagnotte, afin de financer mes prochains achats.

## Critères d'acceptation

- [x] Étant donné une partie validée rapportant des jerricans à mon équipe, quand
      elle est enregistrée, alors un mouvement de cagnotte RECOMPENSE positif est
      créé automatiquement.
- [x] Étant donné cette récompense, quand je consulte ma cagnotte, alors elle est
      augmentée du montant correspondant.

## Vérification code (2026-07-03)

Repassée de `done` à `backlog` : non implémenté. `Campaign.recordResult()` ne crée
que des `RankingAssignedEvent` (Points de Championnat) — aucun `WalletMovementEvent`
n'est créé lors de l'enregistrement d'un résultat. `RecordResultDto` et le
formulaire frontend `GameResultForm` ne portent que `{participantId, rank}`, pas de
champ récompense. Créditer des jerricans exige aujourd'hui un appel manuel séparé à
`POST .../events/wallet`, que le frontend n'invoque jamais.

## Vérification code (2026-07-17)

Implémenté — le wizard de fin de partie crédite automatiquement `WalletMovementEvent(RECOMPENSE)` via deux mécanismes : l'écran Jerricans (butin manuel du scénario, `jerricanGains` en `RecordResultDto`) et l'écran Résolution (revenu de base D6 pour Escarmouche, `POST .../events/income`). Les 2 critères sont pleinement satisfaits, sans action manuelle au-delà du wizard.
