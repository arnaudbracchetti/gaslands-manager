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

**Verrouillage par une campagne en cours** : dès qu'une équipe est engagée (participant `VALIDATED`) dans une campagne dont l'état n'est plus `EN_CONSTRUCTION` (`EN_COURS` ou `TERMINEE`), l'équipe est intégralement verrouillée — `Team.assertNotLocked()` refuse (`DomainException` → HTTP 400) toute mutation directe : modification/suppression de l'équipe, ajout/suppression de véhicule, arme (montée sur Tourelle ou non), amélioration. Le flag est calculé par `TeamRepository` (jointure `CampaignParticipant` → `Campaign.state`) au chargement de l'agrégat, pas stocké en colonne. **Le flux atelier campagne n'est pas concerné** — pendant qu'une partie est en statut `ATELIER`, l'équipement continue de transiter par l'event-sourcing (`POST /api/campaigns/:id/events/equipment`, cf. [CAMPAIGN.md](CAMPAIGN.md)), qui utilise des méthodes dédiées de l'agrégat (`addCampaignVehicle`, `addCampaignWeapon`…) non soumises à ce verrou.

---

## Résumé des véhicules sur la carte d'équipe

Chaque carte d'équipe affiche la liste de ses véhicules — nom (résolu depuis le catalogue via `nomInterne`) et coût total (prix de base du véhicule + somme des prix de ses armes et améliorations montées). Le frontend charge cette liste via `GET /api/teams/:id/vehicles` et résout les prix via le catalogue du sponsor (`GET /api/catalog/sponsors/:nom`, déjà chargé pour le carousel/builder).

**Cas du montage sur Tourelle** : la Tourelle n'est pas une amélioration séparée mais une
valeur d'orientation de l'arme (`Weapon.orientation === 'tourelle'`, cf.
[VEHICLES.md](VEHICLES.md#montage-sur-tourelle-5ème-valeur-dorientation))
— son coût ×3 est déjà porté par `weapon.prix`, résolu côté backend. Le total affiché
est donc toujours exact, sans approximation (cf. `apps/frontend/src/app/teams/vehicle-summary.ts`).

---

## Modifier / supprimer un véhicule depuis la liste d'équipe

Chaque ligne de la liste (`VehicleSummaryCard`) est cliquable dans son intégralité pour *Gérer l'équipement* — même convention que les cartes équipe/campagne (`TeamCard`/`CampaignCard`) — et porte en plus un bouton dédié 🗑 *Supprimer*. "Modifier un véhicule" ne porte PAS sur ses caractéristiques de base (`nomInterne` immutable) mais sur son équipement : le clic sur la carte navigue vers `/teams/:teamId/vehicles/:vehicleId`, page dédiée (`VehicleConfiguratorPage` → `VehicleConfigurator`) qui permet d'ajouter ET de retirer armes/améliorations sur un véhicule existant. Le bouton *Supprimer* reste une action séparée (`$event.stopPropagation()` empêche son clic de déclencher aussi la navigation).

La suppression d'un véhicule entier (`DELETE /api/vehicles/:id`, cascade sur son équipement) demande confirmation et **ne procède pas par suppression optimiste** : `vehicleCount` doit être resynchronisé après coup — il peut retomber à 0 et déverrouiller le choix du sponsor (cf. règle de verrouillage ci-dessus) — d'où un rechargement complet (`Teams.loadTeams`, déclenché par la recréation du composant au retour sur `/teams`) après chaque action destructrice.

---

## Fiche d'équipe exportable

Bouton "Exporter la fiche d'équipe" sur `/teams/:id/edit` (`TeamEditPage`, masqué si
l'équipe est verrouillée par une campagne en cours - cf. `isLockedByCampaign` ci-dessus)
- génère un document HTML complet et imprimable (A4), destiné à servir de fiche de
référence physique pendant une partie : 2 véhicules par ligne, statistiques (Manœuvrabilité/
Équipage/Emplacements, et carré à dé pour la vitesse courante où le joueur pose un dé
physique) suivies de la carrosserie en cases à cocher, puis un tableau d'équipement
(armes/améliorations/avantages) avec une colonne "N°" étroite (renvoi vers l'annexe de
règles, dédupliqué entre véhicules partageant un même équipement) et une colonne "Effet"
(libellé court et/ou cases de munitions selon l'équipement) - une annexe de règles numérotée
clôt le document. Sur écran (hors impression), le rendu est lui-même contraint à la largeur
d'une page A4 (centré, `@media screen`) pour prévisualiser fidèlement la mise en page imprimée.

**Bandeau d'en-tête** : outre le nom d'équipe, le sponsor et le coût total, affiche le nom
du joueur connecté (prénom + nom, résolu depuis `req.user`, jamais une requête DB
supplémentaire) et, si disponibles, les points de sabotage sous forme de cases à cocher
(une case par point) - une case par point permet au joueur de les cocher au fur et à mesure
qu'il les dépense pendant la partie physique, même idiome visuel que les cases de munitions
d'une ligne d'équipement. Cette ligne Sabotage n'apparaît que sur la fiche mode campagne
(`GET /api/campaigns/:id/sheet`, cf. [CAMPAIGN.md — Fiche d'équipe exportable (mode
campagne)](CAMPAIGN.md#fiche-déquipe-exportable-mode-campagne)) : la fiche "construction
d'équipe" ci-dessous n'a pas cette notion (`sabotagePoints` toujours `null`), les Points de
Résistance n'existant que dans le contexte d'une campagne (cf.
[CAMPAIGN.md — Points de sabotage](CAMPAIGN.md#points-de-sabotage)). Sur cette même fiche
mode campagne, le coût total lui-même est en plus **remplacé** par les Votes du Public
gagnés en début de partie (cf. [CAMPAIGN.md — Fiche d'équipe exportable (mode
campagne)](CAMPAIGN.md#fiche-déquipe-exportable-mode-campagne)).

**Pagination à l'impression** : une carte véhicule (et le texte de ses lignes d'équipement)
ne doit jamais être coupée par un saut de page - si elle ne tient pas entièrement dans la
place restante sur la page courante, elle est intégralement reportée sur la page suivante.
`break-inside: avoid` (CSS) est posé à chaque niveau imbriqué de la carte (ligne de 2
véhicules, carte, en-tête, statistiques, carrosserie, tableau d'équipement ET chacune de ses
lignes) plutôt qu'une seule fois en haut, par prudence vis-à-vis des moteurs de rendu qui
n'appliquent pas toujours cette règle de façon fiable à un conteneur flex/table. L'annexe
démarre en plus systématiquement sur une nouvelle page (`break-before: page`), jamais à la
suite de la dernière ligne de véhicules sur la page courante.

**Logo dans l'en-tête** : le logo (`assets/logo-watermark.png`, copie backend de
`apps/frontend/public/logo gaslands manager.png`) est affiché en pleine opacité dans le
bandeau d'en-tête, à gauche du nom d'équipe. Encodé en data URI directement dans le HTML
(document autonome, cf. ci-dessus) plutôt que chargé via une URL - une fenêtre `about:blank`
(où ce HTML est écrit côté frontend) ne résout aucune URL relative.

**Pas de PDF généré côté backend** : `GET /api/teams/:id/sheet` renvoie du HTML brut
(`Content-Type: text/html`), ouvert dans un nouvel onglet - le joueur utilise ensuite
l'impression native de son navigateur ("Enregistrer en PDF"), le CSS `@page`/A4 étant
déjà prévu pour un rendu imprimé propre.

**Équipe verrouillée par une campagne** (cf. règle de verrouillage ci-dessus) : ce
endpoint la rejette (HTTP 400) plutôt que de produire une fiche silencieusement
incomplète - les chocs/séquelles réels d'une équipe engagée ne sont recalculés que par
replay campagne, jamais reflétés par cette lecture directe. Pour une équipe engagée,
la fiche s'exporte depuis la page de la campagne à la place - cf.
[CAMPAIGN.md — Fiche d'équipe exportable (mode campagne)](CAMPAIGN.md#fiche-déquipe-exportable-mode-campagne).

Détail du format (mapper/renderer partagés avec le point d'entrée campagne, DTOs,
règles de dédup des renvois) : [ARCHITECTURE.md §3.4](../ARCHITECTURE.md#34-architecture-ddd--standard-du-projet).

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
| GET | `/api/teams/:id/sheet` | JWT | Fiche d'équipe exportable (HTML imprimable, `Content-Type: text/html`) — HTTP 400 si l'équipe est verrouillée par une campagne en cours |
