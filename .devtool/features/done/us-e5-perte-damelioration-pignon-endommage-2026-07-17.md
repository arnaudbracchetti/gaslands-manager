---
id: "us-e5-perte-damelioration-pignon-endommage-2026-07-17"
status: "done"
priority: "low"
assignee: null
epic: null
dueDate: null
created: "2026-07-17T00:00:00.000Z"
modified: "2026-07-29T00:00:00.000Z"
completedAt: "2026-07-20T22:01:44.578Z"
labels: ["mode-campagne", "degats-sequelles"]
order: "Zy"
---
# Perte d'avantage sur "Pignon endommagé"

En tant que joueur, je veux que la ligne "Pignon endommagé" de la Table des
Épaves retire un avantage monté du véhicule (tirage aléatoire), distinctement de
la ligne « Arrachée » qui retire une arme ou une amélioration, afin que chaque
tirage soit traité correctement selon les règles du jeu (Gaslands p.168).

## Critères d'acceptation

- [x] Étant donné un véhicule tirant sur la ligne « Pignon endommagé », quand je
      lance la résolution, alors un avantage est retiré (tirage aléatoire dans
      le pool monté) — distinct de la ligne « Arrachée » (arme/amélioration).
- [x] Étant donné un véhicule sans avantage monté, quand la ligne « Pignon
      endommagé » est obtenue, alors aucune perte d'équipement ne s'applique (seul
      le gain de +1 Choc du tirage reste effectif).
- [x] Un avantage perdu apparaît barré avec un badge/filigrane "Perdu" distinct de
      "Vendu" dans l'interface d'atelier — le bouton « Retirer » est désactivé (comme
      pour un équipement vendu).
- [x] Un avantage perdu ne compte plus dans la contrainte d'unicité (rachetable une
      fois perdu, sans attendre qu'un tirage suivant le détruise complètement).
- [x] Bug de persistance corrigé : `ImprovementLostEvent` (perte d'amélioration sur
      Arrachée) est maintenant persité correctement dans la base (colonne `improvementId`
      + dispatcher `eventToOrm`/`toEvent`).

## Notes

Tirage indépendant sur les avantages (pool distinct du pool armes/améliorations).
L'affichage "Perdu" bénéficie rétroactivement à tous les équipements perdus
(armes/améliorations déjà via Arrachée, avantages via Pignon endommagé).

## Vérification code (2026-07-29)

Les 5 critères sont confirmés dans le code :
- Tirage dédié : `buildAdvantagePool` (`wreck-table.ts:185-189`, filtre
  `!a.isSold && !a.isLost`), pioché via `this.random.pick(advantagePool)`
  (`wreck-table.ts:98`), séparé du `equipmentPool` d'Arrachée. Événement créé
  `wreck-table.ts:127`.
- Pool vide → pas d'erreur : `wreck-table.ts:98,103,126`, `lostAdvantage`/
  `advantageLostId` restent `null`, seule la garde `!== null` (l.126) empêche la
  création de l'événement — seul le gain de Chocs reste appliqué.
- Filigrane/retrait bloqué : confirmé dans `mounted-equipment.html` (armes/
  améliorations/avantages, cf. US-E6).
- Unicité excluant `isLost` : `team/domain/vehicle.ts:404`
  (`if (this._advantages.some((a) => !a.isSold && !a.isLost && a.type.equals(type)))`).
- Persistance : colonnes `improvementId`/`advantageId` sur `game-event.entity.ts:84,87`,
  dispatcher `toEvent`/sérialisation dans `campaign.mapper.ts:131-135` et
  `campaign.repository.ts:293-298`.

Dette de test relevée (non bloquante pour ce statut `done`) : aucun test unitaire
ne couvre spécifiquement le tirage `PIGNON_ENDOMMAGE` avec pool d'avantages —
`wreck-table.spec.ts` teste le résultat générique (roll/Chocs) mais pas
`AdvantageLostEvent`/`buildAdvantagePool` ; `game.spec.ts` ne teste
`AdvantageLostEvent` que comme cas générique de replay, hors contexte de tirage.