# Équipes (Teams)

> Sous-document de [SPECIFICATION.md](../SPECIFICATION.md).
> Mettre à jour après tout changement du module Teams.

---

## CRUD Équipes

- **Lister** ses équipes (`GET /api/teams`) — filtrées par utilisateur connecté
- **Créer** une équipe (`POST /api/teams`) : nom, sponsor (validé via le catalogue), budget en jerricans (défaut : 50), description optionnelle
- **Modifier** une équipe (`PUT /api/teams/:id`) : tous les champs modifiables
- **Supprimer** une équipe (`DELETE /api/teams/:id`) — avec confirmation utilisateur

**Réponse enrichie** : toutes les réponses de l'API Teams incluent `vehicleCount: number` — le nombre de véhicules appartenant à l'équipe.

**Carousel de sélection du sponsor** : le formulaire de création/modification charge les 13 sponsors enrichis depuis `/api/catalog/sponsors` et les présente via un carousel interactif (navigation ←/→, indicateurs de position, description + classes + avantages de chaque sponsor).

**Règle de verrouillage du sponsor** : dès qu'un premier véhicule est ajouté à une équipe, le sponsor ne peut plus être modifié. Le carousel affiche un badge 🔒 et bloque la navigation. Cette règle est appliquée côté frontend via le champ `vehicleCount` retourné par l'API.

Sécurité : un utilisateur ne peut accéder qu'à ses propres équipes (filtre `userId` côté backend). Toute tentative d'accès à une équipe d'un autre utilisateur retourne HTTP 404.

---

## Résumé des véhicules sur la carte d'équipe

Chaque carte d'équipe affiche la liste de ses véhicules — nom (résolu depuis le catalogue via `nomInterne`) et coût total (prix de base du véhicule + somme des prix de ses armes et améliorations montées). Le frontend charge cette liste via `GET /api/teams/:id/vehicles` et résout les prix via le catalogue du sponsor (`GET /api/catalog/sponsors/:nom`, déjà chargé pour le carousel/builder).

**Cas particulier de la Tourelle** : son coût réel (3× le prix de l'arme associée) ne peut pas être déterminé — `VehicleImprovement` ne mémorise pas quelle arme une Tourelle équipe. Le frontend l'exclut donc du total et préfixe l'affichage d'un « ≈ » pour signaler un montant minoré (cf. `VehicleSummary.coutApproximatif`, `apps/frontend/src/app/teams/vehicle-summary.ts`).

---

## Modifier / supprimer un véhicule depuis la liste d'équipe

Chaque ligne de la liste porte deux actions — ✏️ *Gérer l'équipement* et 🗑 *Supprimer*. "Modifier un véhicule" ne porte PAS sur ses caractéristiques de base (`nomInterne` immutable) mais sur son équipement : le bouton navigue vers `/teams/:teamId/vehicles/:vehicleId`, page dédiée (`VehicleConfiguratorPage` → `VehicleConfigurator`) qui permet d'ajouter ET de retirer armes/améliorations sur un véhicule existant.

La suppression d'un véhicule entier (`DELETE /api/vehicles/:id`, cascade sur son équipement) demande confirmation et **ne procède pas par suppression optimiste** : `vehicleCount` doit être resynchronisé après coup — il peut retomber à 0 et déverrouiller le choix du sponsor (cf. règle de verrouillage ci-dessus) — d'où un rechargement complet (`Teams.loadTeams`, déclenché par la recréation du composant au retour sur `/teams`) après chaque action destructrice.

---

## Modèle de données — `Team`

| Champ | Type | Contraintes |
|-------|------|-------------|
| `id` | number | PK, auto-incrémenté |
| `name` | string(100) | obligatoire |
| `sponsor` | string(50) | défaut : `"Rutherford"` — immutable dès le 1er véhicule |
| `cans` | number | budget en jerricans, défaut : 50 |
| `description` | text | nullable |
| `userId` | number | FK → User (`CASCADE` on delete) |
| `createdAt` | Date | auto |
| `updatedAt` | Date | auto |

**Champ calculé dans la réponse API** (non stocké en base) :

| Champ | Type | Description |
|-------|------|-------------|
| `vehicleCount` | number | Nombre de véhicules de l'équipe. Utilisé par le frontend pour verrouiller le choix du sponsor. |

Type enrichi côté backend : `TeamWithCount = Team & { vehicleCount: number }` — calculé via `COUNT` SQL, jamais stocké en colonne.

---

## API Endpoints — Équipes

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/teams` | JWT | Liste des équipes de l'utilisateur connecté |
| POST | `/api/teams` | JWT | Créer une équipe |
| PUT | `/api/teams/:id` | JWT | Modifier une équipe |
| DELETE | `/api/teams/:id` | JWT | Supprimer une équipe |
