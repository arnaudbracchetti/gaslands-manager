---
id: "us-d3-acheter-du-materiel-via-latelier-2026-07-03"
status: "backlog"
priority: "high"
assignee: null
dueDate: null
created: "2026-07-03T19:28:55.333Z"
modified: "2026-07-17T00:00:00.000Z"
completedAt: null
labels: ["mode-campagne", "cagnotte-atelier"]
order: "a4"
---

# Acheter du matériel via l'Atelier

En tant que joueur, je veux acheter de nouveaux véhicules/armes/améliorations avec
ma cagnotte, afin de faire évoluer mon équipe entre les parties.

## Critères d'acceptation

- [x] Étant donné une cagnotte suffisante, quand j'achète un item, alors la ligne
      est créée et un mouvement ACHAT négatif est enregistré.
- [x] Étant donné une cagnotte insuffisante, quand je tente un achat, alors il est
      refusé (cagnotte ne peut pas devenir négative).
- [ ] Étant donné un item non autorisé par mon sponsor, quand je tente de l'acheter,
      alors il est refusé (réutilisation des règles du configurateur existant).
- [ ] Étant donné une équipe avec 8 véhicules, quand je tente d'acheter un 9e, alors
      c'est refusé (limite p.165).
- [ ] Étant donné un avantage Cascadeur ou Sur Deux Roues, quand j'en achète un en
      atelier, alors sa condition de pose (Manœuvrabilité effective) est réévaluée,
      pas seulement au listing.
- [x] Étant donné l'Atelier, quand je le valide, alors le budget contrôlé est la
      cagnotte dérivée, pas le Team.cans figé.

## Vérification code (2026-07-03)

Repassée de `done` à `backlog` — 3 gardes métier sur 5 manquent, et surtout
**aucune UI frontend** n'existe pour cette fonctionnalité (cf. US-D1).

## Vérification code (2026-07-17)

Partiellement implémenté — l'UI de l'Atelier existe désormais entièrement (`AtelierPage` + `AtelierVehiclePage`, réutilisant `EquipmentManager`), contrairement à la note 2026-07-03. Le 1ᵉʳ critère (budg suffisant) et le 5ᵉ (budget dérivé) sont vérifiés. Restent non implémentés :
- 2ᵉ/3ᵉ/4ᵉ : sponsor non vérifié à l'écriture (configurateur existe, atelier non), limite de 8 véhicules non vérifiée, Cascadeur/Sur Deux Roues non réévalués à l'écriture (seulement au listing) — tous documentés dans `docs/spec/CAMPAIGN.md#limitations-connues`.

- Budget suffisant/insuffisant : `CampaignParticipant.assertCanAfford`
  (`campaign-participant.ts:100-104`), appelé par `change-equipment.usecase.ts:109`
  → implémenté et correct.
- Budget dérivé (pas `Team.cans` figé) : `loadAndReplay` recalcule `_wallet` avant
  la vérification → implémenté.
- **Sponsor non vérifié** : `catalog.getVehicleType`/`getWeaponType`
  (`catalog.service.ts:238-246`) cherchent dans tout le catalogue, sans filtrer par
  `team.sponsor`/`sponsors_autorises` — contrairement au configurateur d'équipe
  (`add-vehicle.usecase.ts:39-44`). Un joueur peut acheter en Atelier un item
  interdit à son sponsor.
- **Limite de 8 véhicules non vérifiée** : `Team.addCampaignVehicle`
  (`team.ts:179-183`) empile sans aucune limite de nombre.
