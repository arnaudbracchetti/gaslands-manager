# Équipes (Teams)

> Sous-document de [SPECIFICATION.md](../SPECIFICATION.md) - propriétaire du CRUD équipes, des
> verrouillages et de la fiche d'équipe exportable.

---

## CRUD équipes

- **Lister** ses équipes (`GET /api/teams`), **créer** (`POST`, nom, sponsor validé par le catalogue,
  budget en jerricans défaut 50, description optionnelle), **modifier** (`PUT /api/teams/:id`),
  **supprimer** (`DELETE`, avec confirmation).
- **Choix du sponsor** : carousel des 13 sponsors (description, classes, avantages).
- **Sécurité** : un utilisateur n'accède qu'à ses équipes (filtre `userId`) ; sinon 404.

**Verrouillage du sponsor** : dès le premier véhicule, le sponsor n'est plus modifiable (badge, carousel
bloqué), piloté côté frontend par `vehicleCount`. Raison : [VEHICLES.md](VEHICLES.md#sponsors-13).

**Verrouillage par une campagne en cours** : une équipe engagée (participant `VALIDATED`) dans une
campagne `EN_COURS` ou `TERMINEE` est entièrement verrouillée : `Team.assertNotLocked()` refuse (400)
toute mutation directe (équipe, véhicules, armes, améliorations, avantages, renommage). Le flag est
calculé par `TeamRepository` (jointure participant → état de campagne) au chargement, jamais stocké.
**L'atelier n'est pas concerné** : il passe par l'event sourcing de la campagne et des méthodes de
l'agrégat non soumises à ce verrou ([CAMPAIGN.md](CAMPAIGN.md#cycle-de-vie-dune-partie-et-phase-atelier)).

**Suppression de l'équipe du dernier organisateur** : `campaign_participants.teamId` porte un
`ON DELETE CASCADE` qui supprimerait la participation sans passer par l'agrégat `Campaign`.
`RemoveTeamUseCase` refuse donc (400, campagnes concernées citées) de supprimer l'équipe engagée du
dernier organisateur validé d'une campagne (en pratique `EN_CONSTRUCTION`, au-delà le verrou ci-dessus
s'applique). Vérification par `ITeamRepository.findCampaignsOrphanedIfTeamRemoved` (implémentée dans
`TeamRepository` pour éviter une dépendance circulaire `TeamModule` ↔ `CampaignModule`). Même invariant
côté compte : [AUTH.md](AUTH.md#suppression-dun-compte-engagé-comme-organisateur-de-campagne).

---

## Liste des véhicules d'une équipe

- Chaque carte d'équipe liste ses véhicules : nom et coût total (base + armes, améliorations et avantages,
  coût ×3 d'une tourelle déjà porté par `weapon.prix`), calculés par `vehicle-summary.ts`.
- Sur `/teams/:id/edit`, chaque carte véhicule est cliquable vers la gestion de l'équipement
  (`/teams/:teamId/vehicles/:vehicleId`) ; un bouton dédié supprime le véhicule.
- La suppression (`DELETE /api/vehicles/:id`, cascade) demande confirmation et **n'est pas optimiste** :
  la liste est rechargée, car `vehicleCount` peut retomber à 0 et déverrouiller le sponsor.

---

## Fiche d'équipe exportable

Bouton « Exporter la fiche d'équipe » sur `/teams/:id/edit`, masqué si l'équipe est verrouillée par une
campagne. `GET /api/teams/:id/sheet` renvoie un document HTML autonome (`text/html`), ouvert dans un
nouvel onglet ; le joueur imprime ou enregistre en PDF depuis son navigateur (CSS `@page` A4, pas de PDF
côté serveur). À l'écran, le rendu est contraint à la largeur A4 pour prévisualiser l'impression.

- **Bandeau** : logo (data URI, car une fenêtre `about:blank` ne résout pas d'URL relative), nom
  d'équipe, sponsor, coût total, nom du joueur (`req.user.callName`, sans requête supplémentaire).
- **Véhicules** : 2 par ligne ; statistiques (Manœuvrabilité, Équipage, Emplacements, carré à dé pour la
  vitesse), carrosserie en cases à cocher, tableau d'équipement (armes, améliorations, avantages,
  séquelles) avec colonne « N° » (renvoi vers l'annexe, dédupliqué entre véhicules) et colonne « Effet »
  (`effet_court` et/ou cases de munitions).
- **Annexe** de règles numérotée, toujours sur une nouvelle page.
- **Pagination** : une carte véhicule n'est jamais coupée ; `break-inside: avoid` est posé à chaque niveau
  (ligne, carte, sections, chaque ligne du tableau), par prudence envers les moteurs qui l'appliquent mal
  aux conteneurs flex/table.
- **Équipe verrouillée** : refusé (400) plutôt qu'une fiche incomplète - chocs et séquelles ne sont connus
  que par replay de la campagne. La fiche se prend alors depuis la page de la campagne, qui ajoute
  points de sabotage et Votes du Public ([CAMPAIGN.md](CAMPAIGN.md#fiche-déquipe-exportable-mode-campagne)).

Mapper et renderer partagés : [ARCHITECTURE.md §3.4](../ARCHITECTURE.md#34-architecture-ddd---standard-du-projet).

---

## Modèle de données - `Team`

| Champ | Type | Contraintes |
|---|---|---|
| `id` | number | PK |
| `name` | string(100) | obligatoire |
| `sponsor` | string(50) | défaut `"Rutherford"`, immuable dès le 1er véhicule |
| `cans` | number | budget saisi, défaut 50 ; inerte si l'équipe est engagée dans une campagne |
| `description` | text | nullable |
| `userId` | number | FK → User `CASCADE` |
| `createdAt` / `updatedAt` | Date | auto |

**Champs calculés** (`TeamSummaryDto`, depuis l'agrégat chargé) :

| Champ | Description |
|---|---|
| `vehicleCount` | nombre de véhicules (verrouillage du sponsor) |
| `vehiclesCost` | coût cumulé des véhicules (éligibilité au budget d'une campagne) |
| `budget` | budget applicable : celui de la campagne engageante, sinon `cans` |
| `campaignBudget` | non null ⇒ budget imposé par une campagne, `cans` en lecture seule dans l'IHM |
| `isEngaged` | équipe engagée dans une campagne |
| `isLockedByCampaign` | verrouillage par une campagne en cours |

---

## API Endpoints (JWT)

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/teams` | mes équipes |
| POST | `/api/teams` | créer |
| PUT | `/api/teams/:id` | modifier (400 si verrouillée) |
| DELETE | `/api/teams/:id` | supprimer (400 si verrouillée, ou équipe du dernier organisateur d'une campagne) |
| GET | `/api/teams/:id/sheet` | fiche d'équipe HTML (400 si verrouillée) |
