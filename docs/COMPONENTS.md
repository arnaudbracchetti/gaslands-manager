# Composants Angular — Gaslands Manager

> Source unique de vérité pour l'architecture frontend. Mettre à jour après tout ajout ou suppression de composant.

---

## Conventions

### Smart vs Dumb

- **Smart** : connaît les services, gère les appels HTTP et l'état d'affichage (Signals d'état, computed, subscriptions). Exemples : `Teams`, `SeasonDetail`, `EquipmentManager`.
- **Dumb** : reçoit des données via `input()`, émet des événements via `output()`. Ne connaît aucun service. Exemples : `TeamCard`, `SponsorCarousel`, `ConfirmModal`.

### Pattern `locked`

Un composant dumb peut recevoir un input booléen `locked` pour appliquer une contrainte métier sans en connaître la raison. Le parent seul décide quand et pourquoi verrouiller (ex : sponsor immutable dès qu'un véhicule existe dans `SponsorCarousel`).

### Signals et zoneless

Zone.js est absent — tout changement d'état doit passer par un Signal (`signal()`, `computed()`). Utiliser `effect()` dans le constructeur pour réagir aux changements d'un `input()` Signal (ex : pré-remplissage de formulaire quand l'entité à éditer change).

---

## Composants réutilisables

Ces trois composants sont indépendants de tout domaine métier et utilisables partout.

### `SlotGauge` — `shared/slot-gauge/`

Jauge visuelle représentant des emplacements occupés/disponibles (grille de carrés plein/vide).

| | |
|---|---|
| **Sélecteur** | `app-slot-gauge` |
| **Type** | Dumb |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `used` | `number` | — | Emplacements occupés |
| `total` | `number` | — | Capacité totale |
| `size` | `'sm' \| 'md' \| 'lg'` | `'sm'` | Taille des carrés |

Utilisé par : `TeamCard`, `VehicleChoiceCard`, `VehicleSummaryCard`, `VehicleCostSummary`.

---

### `ConfirmModal` — `shared/confirm-modal/`

Dialog de confirmation générique. Le parent contrôle la visibilité via `@if`.

| | |
|---|---|
| **Sélecteur** | `app-confirm-modal` |
| **Type** | Dumb |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `message` | `string` | — | Question posée à l'utilisateur |
| `confirmLabel` | `string` | `'Confirmer'` | Label du bouton de validation |
| `cancelLabel` | `string` | `'Annuler'` | Label du bouton d'annulation |
| `variant` | `'danger' \| 'primary'` | `'danger'` | Style du bouton de validation |

**Outputs**

| Nom | Type | Description |
|-----|------|-------------|
| `confirmed` | `void` | L'utilisateur a confirmé |
| `cancelled` | `void` | L'utilisateur a annulé |

Utilisé par : `TeamEditPage`, `EquipmentManager`, `CampaignDetail`, `AdminUsers`.

---

### `Breadcrumb` — `shared/breadcrumb/`

Fil d'ariane de navigation. Les items avec `route` sont des `RouterLink`, les autres sont du texte brut.

| | |
|---|---|
| **Sélecteur** | `app-breadcrumb` |
| **Type** | Dumb |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `crumbs` | `BreadcrumbItem[]` | — | Liste `{ label: string; route?: string[] }` |

Utilisé par : `VehicleConfiguratorPage`, `CampaignDetail`.

---

## Diagramme de dépendances

```mermaid
graph TD
    subgraph Shared["Shared (réutilisables)"]
        SlotGauge
        ConfirmModal
        Breadcrumb
    end

    subgraph Teams
        TeamsPage["Teams (smart)"]
        TeamCard
        TeamForm
        SponsorCarousel
        TeamEditPage["TeamEditPage (smart)"]
        VehicleSummaryCard
        QuickTeamCreate

        subgraph Configurateur
            VehicleConfiguratorPage["VehicleConfiguratorPage (smart)"]
            VehicleConfigurator["VehicleConfigurator (smart)"]
            VehicleChoiceCard

            subgraph EquipmentManager_group["EquipmentManager"]
                EquipmentManager["EquipmentManager (smart)"]
                EquipmentOption
                EquipmentDetailModal
                MountedEquipment
                TourelleAssignmentModal
                TeamBudget
                VehicleCostSummary
            end
        end
    end

    subgraph Campaigns
        CampaignsPage["Campaigns (smart)"]
        CampaignCard
        CampaignForm
        CampaignDetail["CampaignDetail (smart)"]
        CampaignJoin["CampaignJoin (smart)"]
        ParticipantList
        InviteLink
        ChangeTeamModal
        CampaignProgram["CampaignProgram (smart)"]
        GameList
        GameForm
        GameResultWizard
        RankingStep
        WreckDesignationStep
        WreckResolutionStep
    end

    subgraph Admin
        AdminUsers["AdminUsers (smart)"]
    end

    TeamsPage --> TeamCard
    TeamsPage --> TeamForm
    TeamCard --> SlotGauge
    TeamForm --> SponsorCarousel
    TeamEditPage --> VehicleSummaryCard
    TeamEditPage --> SponsorCarousel
    TeamEditPage --> ConfirmModal
    VehicleSummaryCard --> SlotGauge
    VehicleConfiguratorPage --> VehicleConfigurator
    VehicleConfiguratorPage --> Breadcrumb
    VehicleConfigurator --> VehicleChoiceCard
    VehicleConfigurator --> EquipmentManager
    VehicleChoiceCard --> SlotGauge
    EquipmentManager --> EquipmentOption
    EquipmentManager --> MountedEquipment
    EquipmentManager --> TourelleAssignmentModal
    EquipmentManager --> TeamBudget
    EquipmentManager --> VehicleCostSummary
    EquipmentManager --> ConfirmModal
    EquipmentOption --> EquipmentDetailModal
    VehicleCostSummary --> SlotGauge
    CampaignsPage --> CampaignCard
    CampaignsPage --> CampaignForm
    CampaignForm --> QuickTeamCreate
    CampaignJoin --> QuickTeamCreate
    CampaignDetail --> ParticipantList
    CampaignDetail --> InviteLink
    CampaignDetail --> ChangeTeamModal
    CampaignDetail --> ConfirmModal
    CampaignDetail --> Breadcrumb
    CampaignDetail --> CampaignProgram
    CampaignProgram --> GameList
    CampaignProgram --> GameForm
    CampaignProgram --> GameResultWizard
    CampaignProgram --> ConfirmModal
    GameResultWizard --> RankingStep
    GameResultWizard --> WreckDesignationStep
    GameResultWizard --> WreckResolutionStep
    AdminUsers --> ConfirmModal
```

---

## Domaine Auth

### `Login` — `auth/login/`

Page de connexion (email + mot de passe). Navigue vers `/home` en cas de succès.

| | |
|---|---|
| **Sélecteur** | `app-login` |
| **Type** | Smart |
| **Route** | `/login` |
| **Services** | `AuthService`, `Router` |

---

### `Register` — `auth/register/`

Page d'inscription (prénom, nom, email, mot de passe). Crée le compte et navigue vers `/home`.

| | |
|---|---|
| **Sélecteur** | `app-register` |
| **Type** | Smart |
| **Route** | `/register` |
| **Services** | `AuthService`, `Router` |

---

## Pages publiques

### `Home` — `home/`

Page d'accueil publique avec présentation et liens vers les sections.

| | |
|---|---|
| **Sélecteur** | `app-home` |
| **Type** | Smart |
| **Route** | `/home` |

---

### `Rules` — `rules/`

Charge les règles du jeu depuis `GET /api/content/regles` (Markdown → HTML) et les affiche via `[innerHTML]`.

| | |
|---|---|
| **Sélecteur** | `app-rules` |
| **Type** | Smart |
| **Route** | `/rules` |
| **Services** | `HttpClient` |

---

### `Vehicles` — `vehicles/`

Placeholder — affichera à terme le catalogue dynamique des véhicules depuis `/api/catalog/vehicules`.

| | |
|---|---|
| **Sélecteur** | `app-vehicles` |
| **Type** | — |
| **Route** | `/vehicles` |

---

### `Weapons` — `weapons/`

Placeholder — affichera à terme le catalogue dynamique des armes depuis `/api/catalog/armes`.

| | |
|---|---|
| **Sélecteur** | `app-weapons` |
| **Type** | — |
| **Route** | `/weapons` |

---

## Domaine Teams

### `Teams` — `teams/` 🧠

Page principale listant toutes les équipes de l'utilisateur connecté. Gère la création via une modale inline et charge les résumés de véhicules pour chaque équipe.

| | |
|---|---|
| **Sélecteur** | `app-teams` |
| **Type** | Smart |
| **Route** | `/teams` |
| **Services** | `TeamsService`, `VehicleService`, `CatalogService`, `Router` |
| **Compose** | `TeamCard`, `TeamForm` |

**Signals clés** : `teams`, `loading`, `showForm`, `vehicleSummaries: Map<number, VehicleSummary[]>`.

---

### `TeamCard` — `teams/team-card/`

Carte d'affichage d'une équipe : nom, sponsor, barre de budget, liste des véhicules. Navigue vers la page d'édition au clic.

| | |
|---|---|
| **Sélecteur** | `app-team-card` |
| **Type** | Dumb |
| **Compose** | `SlotGauge` |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `team` | `Team` | — | Équipe à afficher |
| `index` | `number` | `1` | Indice pour l'affichage (numéro formaté) |
| `vehicles` | `VehicleSummary[]` | `[]` | Résumés des véhicules de l'équipe |

**Outputs**

| Nom | Type | Description |
|-----|------|-------------|
| `cardClicked` | `Team` | Clic sur la carte → navigation vers l'édition |

---

### `TeamForm` — `teams/team-form/`

Formulaire de création ou de modification d'une équipe (nom, sponsor, budget, description). Charge le catalogue de sponsors pour le carousel.

| | |
|---|---|
| **Sélecteur** | `app-team-form` |
| **Type** | Dumb |
| **Services** | `CatalogService` |
| **Compose** | `SponsorCarousel` |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `team` | `Team \| null` | `null` | `null` = mode création, sinon pré-remplit le formulaire |
| `saving` | `boolean` | `false` | Désactive les boutons pendant la sauvegarde |
| `hasVehicles` | `boolean` | `false` | Verrouille le choix du sponsor |

**Outputs**

| Nom | Type | Description |
|-----|------|-------------|
| `saved` | `CreateTeamDto` | Formulaire soumis avec les données validées |
| `formCancel` | `void` | Annulation |

---

### `SponsorCarousel` — `teams/sponsor-carousel/`

Carousel interactif pour choisir un sponsor. Navigation ←/→, affichage du nom, de la description et des avantages (Markdown → HTML). Navigation bloquée si `locked`.

| | |
|---|---|
| **Sélecteur** | `app-sponsor-carousel` |
| **Type** | Dumb |
| **Services** | `DomSanitizer` |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `sponsors` | `SponsorInfo[]` | `[]` | Liste des sponsors chargés depuis le catalogue |
| `selectedSponsor` | `string` | `''` | Nom du sponsor actuellement sélectionné |
| `locked` | `boolean` | `false` | Bloque la navigation (équipe avec véhicules) |

**Outputs**

| Nom | Type | Description |
|-----|------|-------------|
| `sponsorChange` | `string` | Nouveau nom de sponsor sélectionné |

---

### `TeamEditPage` — `teams/team-edit-page/` 🧠

Page de gestion d'une équipe (`/teams/:id/edit`). Layout deux panneaux : formulaire d'édition à gauche, liste des véhicules à droite. Gère la modification de l'équipe, l'ajout/suppression de véhicules.

| | |
|---|---|
| **Sélecteur** | `app-team-edit-page` |
| **Type** | Smart |
| **Route** | `/teams/:id/edit` |
| **Services** | `ActivatedRoute`, `Router`, `TeamsService`, `VehicleService`, `CatalogService` |
| **Compose** | `SponsorCarousel`, `VehicleSummaryCard`, `ConfirmModal` |

**Signals clés** : `team`, `vehicles`, `loading`, `saving`, `hasVehicles`, `budgetUtilise`, `budgetRestant`, `pendingDeleteTeam`, `pendingDeleteVehicleId`.

---

### `VehicleSummaryCard` — `teams/vehicle-summary-card/`

Carte affichant le résumé d'un véhicule dans la liste de l'équipe : nom, coût total, emplacements. Émet les actions Gérer et Supprimer.

| | |
|---|---|
| **Sélecteur** | `app-vehicle-summary-card` |
| **Type** | Dumb |
| **Compose** | `SlotGauge` |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `vehicle` | `VehicleSummary` | — | Résumé du véhicule |

**Outputs**

| Nom | Type | Description |
|-----|------|-------------|
| `manageClicked` | `number` | ID du véhicule → navigation vers le configurateur |
| `deleteClicked` | `VehicleSummary` | Demande de suppression du véhicule |

---

### `QuickTeamCreate` — `teams/quick-team-create/`

Widget de création rapide d'équipe (champ nom uniquement). Utilisé dans les formulaires de saison pour créer une équipe à la volée sans quitter le flux.

| | |
|---|---|
| **Sélecteur** | `app-quick-team-create` |
| **Type** | Dumb |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `saving` | `boolean` | `false` | Désactive les boutons pendant la sauvegarde |

**Outputs**

| Nom | Type | Description |
|-----|------|-------------|
| `created` | `CreateTeamDto` | Données de création soumises |

---

### `VehicleConfiguratorPage` — `teams/vehicle-configurator-page/` 🧠

Wrapper de page pour la configuration d'un véhicule. Détermine le mode (création vs édition) depuis la route, charge l'équipe, fournit le fil d'ariane.

| | |
|---|---|
| **Sélecteur** | `app-vehicle-configurator-page` |
| **Type** | Smart |
| **Routes** | `/teams/:teamId/vehicles/new` · `/teams/:teamId/vehicles/:vehicleId` |
| **Services** | `ActivatedRoute`, `Router`, `TeamsService` |
| **Compose** | `VehicleConfigurator`, `Breadcrumb` |

**Signals clés** : `team`, `vehicleId`, `loading`, `error`, `backRoute`, `breadcrumbs`.

---

### `VehicleConfigurator` — `teams/vehicle-configurator/` 🧠

Orchestrateur unifié pour la création et l'édition d'équipement d'un véhicule. En mode création : affiche le choix du véhicule de base. Une fois le véhicule créé ou chargé, affiche `EquipmentManager`.

| | |
|---|---|
| **Sélecteur** | `app-vehicle-configurator` |
| **Type** | Smart |
| **Services** | `CatalogService`, `VehicleService` |
| **Compose** | `VehicleChoiceCard`, `EquipmentManager` |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `team` | `Team` | — | Équipe propriétaire |
| `vehicleId` | `number \| null` | — | `null` = création, sinon ID du véhicule à éditer |

**Outputs**

| Nom | Type | Description |
|-----|------|-------------|
| `done` | `void` | Fin de la session de configuration |

---

### `VehicleChoiceCard` — `teams/vehicle-configurator/vehicle-choice-card/`

Carte de sélection du type de véhicule de base. Affiche les statistiques du véhicule (carrosserie, manoeuvrabilité, vitesse, équipage, emplacements, prix).

| | |
|---|---|
| **Sélecteur** | `app-vehicle-choice-card` |
| **Type** | Dumb |
| **Compose** | `SlotGauge` |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `vehicule` | `Vehicule` | — | Véhicule du catalogue filtré par sponsor |

**Outputs**

| Nom | Type | Description |
|-----|------|-------------|
| `chosen` | `Vehicule` | Le joueur a choisi ce type de véhicule |

---

### `EquipmentManager` — `teams/vehicle-configurator/equipment-manager/` 🧠

Cœur de la gestion d'équipement. Charge les armes et améliorations disponibles (avec verdicts du backend), gère l'ajout/retrait, le cas particulier de la Tourelle, et affiche le budget de l'équipe.

| | |
|---|---|
| **Sélecteur** | `app-equipment-manager` |
| **Type** | Smart |
| **Services** | `VehicleService` |
| **Compose** | `EquipmentOption`, `MountedEquipment`, `TourelleAssignmentModal`, `TeamBudget`, `VehicleCostSummary`, `ConfirmModal` |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `vehicle` | `Vehicle` | — | Entité véhicule brute (avec armes/améliorations montées) |
| `sponsorCatalog` | `Sponsor` | — | Catalogue complet du sponsor (noms, prix, règles) |
| `team` | `Team` | — | Équipe (budget, autres véhicules) |

**Outputs**

| Nom | Type | Description |
|-----|------|-------------|
| `vehicleChanged` | `Vehicle` | Émis après chaque mutation — le parent met à jour son signal |

**Signals computed clés** : `emplacementsUtilises`, `emplacementsTotal`, `coutBase`, `coutEquipement`, `coutTotal`, `budgetRestant`, `budgetDepasse`, `visibleWeapons`, `visibleImprovements`, `armesPourTourelle`.

---

### `EquipmentOption` — `teams/vehicle-configurator/equipment-option/`

Carte d'un équipement disponible dans le catalogue. Si orientable, affiche un sélecteur de direction avant d'émettre le choix. Ouvre `EquipmentDetailModal` au clic sur la carte.

| | |
|---|---|
| **Sélecteur** | `app-equipment-option` |
| **Type** | Dumb |
| **Compose** | `EquipmentDetailModal` |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `option` | `EquipmentOptionDto` | — | Arme ou amélioration avec verdict de disponibilité |
| `requiresOrientation` | `boolean` | `false` | Indique si un arc de tir doit être sélectionné |

**Outputs**

| Nom | Type | Description |
|-----|------|-------------|
| `chosen` | `EquipmentChoice` | `{ nomInterne, orientation? }` — émis seulement quand l'info est complète |

---

### `EquipmentDetailModal` — `teams/vehicle-configurator/equipment-option/equipment-detail-modal/`

Popup d'information sur un équipement : nom, coût, emplacement, description, règles complètes. Purement informative — aucune action d'ajout.

| | |
|---|---|
| **Sélecteur** | `app-equipment-detail-modal` |
| **Type** | Dumb |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `option` | `EquipmentOptionDto` | — | Données de l'équipement |
| `requiresOrientation` | `boolean` | `false` | Affiché dans les métadonnées |

**Outputs**

| Nom | Type | Description |
|-----|------|-------------|
| `closed` | `void` | Fermeture de la popup (bouton ou clic overlay) |

---

### `MountedEquipment` — `teams/vehicle-configurator/equipment-manager/mounted-equipment/`

Affiche les armes et améliorations actuellement montées sur le véhicule, avec leurs boutons de retrait. Gère l'affichage spécial de la Tourelle (orpheline vs assignée).

| | |
|---|---|
| **Sélecteur** | `app-mounted-equipment` |
| **Type** | Dumb |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `weapons` | `Weapon[]` | — | Armes montées |
| `improvements` | `VehicleImprovement[]` | — | Améliorations montées |
| `sponsorCatalog` | `Sponsor` | — | Pour résoudre les noms et emplacements depuis les `nomInterne` |

**Outputs**

| Nom | Type | Description |
|-----|------|-------------|
| `weaponRemoved` | `Weapon` | Demande de retrait d'une arme |
| `improvementRemoved` | `VehicleImprovement` | Demande de retrait d'une amélioration |
| `tourelleAssignRequested` | `VehicleImprovement` | Tourelle orpheline → ouvre la modale d'assignation |
| `tourelleUnassignRequested` | `VehicleImprovement` | Désassigner l'arme d'une Tourelle |

---

### `TourelleAssignmentModal` — `teams/vehicle-configurator/equipment-manager/tourelle-assignment-modal/`

Modale de sélection de l'arme à monter sur une Tourelle orpheline. Affiche chaque arme candidate avec son prix × 3.

| | |
|---|---|
| **Sélecteur** | `app-tourelle-assignment-modal` |
| **Type** | Dumb |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `armes` | `Arme[]` | — | Armes candidates (hors type équipage, dans la limite des emplacements) |

**Outputs**

| Nom | Type | Description |
|-----|------|-------------|
| `weaponChosen` | `string` | `nomInterne` de l'arme choisie |
| `cancelled` | `void` | Annulation |

---

### `TeamBudget` — `teams/vehicle-configurator/equipment-manager/team-budget/`

Bloc d'affichage du budget de l'équipe (tous véhicules confondus) : barre de progression, jerricans utilisés/total, solde ou dépassement. Toutes les valeurs sont pré-calculées par `EquipmentManager`.

| | |
|---|---|
| **Sélecteur** | `app-team-budget` |
| **Type** | Dumb |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `budgetEquipe` | `number` | — | Budget total de l'équipe |
| `coutEquipeTotal` | `number` | — | Coût total de tous les véhicules |
| `budgetRestant` | `number` | — | Solde restant (peut être négatif) |
| `budgetDepasse` | `boolean` | — | Vrai si dépassement |
| `budgetPourcentage` | `number` | — | Pourcentage pour la barre (0–100, plafonné) |

---

### `VehicleCostSummary` — `teams/vehicle-configurator/equipment-manager/vehicle-cost-summary/`

Récapitulatif du coût du véhicule en cours : nom, jauge d'emplacements, décomposition base / équipement / total.

| | |
|---|---|
| **Sélecteur** | `app-vehicle-cost-summary` |
| **Type** | Dumb |
| **Compose** | `SlotGauge` |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `vehicleName` | `string` | — | Nom affiché (déjà résolu depuis le catalogue) |
| `emplacementsUtilises` | `number` | — | Emplacements occupés |
| `emplacementsTotal` | `number` | — | Capacité totale |
| `coutBase` | `number` | — | Prix du châssis |
| `coutEquipement` | `number` | — | Somme des armes et améliorations |
| `coutTotal` | `number` | — | Base + équipement |

---

## Domaine Campaigns

### `Campaigns` — `campaigns/` 🧠

Page principale listant toutes les campagnes de l'utilisateur. Gère la création via une modale et affiche les badges de demandes en attente.

| | |
|---|---|
| **Sélecteur** | `app-campaigns` |
| **Type** | Smart |
| **Route** | `/campaigns` |
| **Services** | `CampaignsService`, `TeamsService`, `Router` |
| **Compose** | `CampaignCard`, `CampaignForm` |

**Signals clés** : `campaigns`, `loading`, `showForm`, `userTeams`, `pendingCampaignIds`, `organizedPendingCounts`.

---

### `CampaignCard` — `campaigns/campaign-card/`

Carte d'affichage d'une campagne : nom, état, badge de rôle (🏆 Organisateur / ⏳ En attente), alerte de demandes à valider.

| | |
|---|---|
| **Sélecteur** | `app-campaign-card` |
| **Type** | Dumb |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `campaign` | `Campaign` | — | Campagne à afficher |
| `index` | `number` | `1` | Indice pour l'affichage |
| `isPending` | `boolean` | `false` | Affiche le badge "En attente" |
| `pendingRequestsCount` | `number` | `0` | Nombre de demandes à valider (badge organisateur) |

---

### `CampaignForm` — `campaigns/campaign-form/`

Formulaire de création d'une campagne (nom + sélection optionnelle d'une équipe). Propose la création rapide d'équipe via `QuickTeamCreate`. Auto-sélectionne la nouvelle équipe via `effect()`.

| | |
|---|---|
| **Sélecteur** | `app-campaign-form` |
| **Type** | Dumb |
| **Compose** | `QuickTeamCreate` |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `saving` | `boolean` | `false` | Désactive les boutons pendant la sauvegarde |
| `teams` | `Team[]` | `[]` | Équipes disponibles pour la sélection |
| `creatingTeam` | `boolean` | `false` | Affiche un indicateur pendant la création rapide |

**Outputs**

| Nom | Type | Description |
|-----|------|-------------|
| `saved` | `CreateCampaignDto` | Données de création soumises `{ name, teamId? }` |
| `formCancel` | `void` | Annulation |
| `teamCreated` | `CreateTeamDto` | Relaie la demande de création rapide d'équipe vers le parent |

---

### `CampaignDetail` — `campaigns/campaign-detail/` 🧠

Page de détail d'une campagne (`/campaigns/:id`). Affiche participants, code d'invitation, transitions d'état. Les sections "En attente" et "Refusé" sont absentes du DOM pour les non-organisateurs. Charge également le classement (`GET .../standings`) pour transmettre les Points de Championnat à `ParticipantList` — chargement indépendant et non bloquant : si `/standings` échoue, la liste des participants reste affichée sans PC. Rechargé aussi via `onResultRecorded()`, appelé quand `CampaignProgram` émet `resultRecorded` après l'enregistrement d'un résultat de partie — sans ce pont, le classement resterait figé jusqu'au prochain rechargement de page.

| | |
|---|---|
| **Sélecteur** | `app-campaign-detail` |
| **Type** | Smart |
| **Route** | `/campaigns/:id` |
| **Services** | `ActivatedRoute`, `Router`, `CampaignsService`, `AuthService`, `TeamsService` |
| **Compose** | `ParticipantList`, `InviteLink`, `ChangeTeamModal`, `ConfirmModal`, `Breadcrumb` |

**Signals clés** : `campaign`, `participants`, `standings`, `championshipPoints`, `myTeams`, `loading`, `myParticipant`, `isOrganizer`, `canChangeTeam`, `validatedCount`, `pendingCount`.

---

### `CampaignJoin` — `campaigns/campaign-join/` 🧠

Page de demande d'inscription à une campagne via son code d'invitation (`/campaigns/join/:code`). Charge le résumé de la campagne, propose la création rapide d'équipe.

| | |
|---|---|
| **Sélecteur** | `app-campaign-join` |
| **Type** | Smart |
| **Route** | `/campaigns/join/:code` |
| **Services** | `ActivatedRoute`, `CampaignsService`, `TeamsService` |
| **Compose** | `QuickTeamCreate` |

**Signals clés** : `loading`, `summary`, `userTeams`, `selectedTeamId`, `submitting`, `submitted`.

---

### `ParticipantList` — `campaigns/participant-list/`

Liste unifiée des participants d'une campagne avec boutons d'action adaptés au statut et au rôle. Encapsule toutes les règles de visibilité (organisateur uniquement, pas de self-reject sur le dernier organisateur, etc.).

**Classement (PC)** : la liste est triée par Points de Championnat décroissants (tri stable — tant qu'aucun point n'existe pour aucun participant, l'ordre affiché reste celui d'origine). Le badge "🏆 X PC" n'est affiché que pour les participants `VALIDATED` ; les `PENDING`/`REJECTED` comptent pour 0 PC dans le tri sans afficher de badge. Les PC proviennent de `GET /api/campaigns/:id/standings` (calculé côté backend, cf. [CAMPAIGN.md](spec/CAMPAIGN.md)), chargé par `CampaignDetail` et transmis sous forme de map.

| | |
|---|---|
| **Sélecteur** | `app-participant-list` |
| **Type** | Dumb |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `participants` | `CampaignParticipant[]` | — | Tous statuts confondus |
| `championshipPoints` | `ReadonlyMap<number, number>` | `new Map()` | PC par `participantId` — absent = 0 (aucune partie jouée) |
| `isOrganizer` | `boolean` | `false` | Active les boutons d'action organisateur |
| `currentUserId` | `number \| undefined` | `undefined` | Pour masquer les actions sur soi-même |
| `canChangeTeam` | `boolean` | `false` | Affiche le lien "Changer d'équipe" |
| `campaignId` | `number \| undefined` | `undefined` | Pour construire le lien vers l'édition de l'équipe |

**Outputs**

| Nom | Type | Description |
|-----|------|-------------|
| `validate` | `{ pid: number; accept: boolean }` | Couvre PENDING→VALIDATED/REJECTED, VALIDATED→REJECTED, REJECTED→VALIDATED |
| `remove` | `number` | `pid` — suppression définitive (organisateur, EN_CONSTRUCTION) |
| `promote` | `number` | `pid` — promotion co-organisateur |
| `changeTeam` | `void` | Ouvre la modale de changement d'équipe |

---

### `InviteLink` — `campaigns/invite-link/`

Affiche le code d'invitation d'une campagne avec un bouton "Copier". Feedback visuel temporaire "Copié !" après copie dans le presse-papiers.

| | |
|---|---|
| **Sélecteur** | `app-invite-link` |
| **Type** | Dumb |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `inviteCode` | `string` | — | Code d'invitation à afficher |

---

### `ChangeTeamModal` — `campaigns/change-team-modal/`

Overlay de sélection d'une autre équipe à engager dans une campagne `EN_CONSTRUCTION`. Le parent contrôle la visibilité.

| | |
|---|---|
| **Sélecteur** | `app-change-team-modal` |
| **Type** | Dumb |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `teams` | `Team[]` | — | Équipes de l'utilisateur |
| `currentTeamId` | `number \| null` | — | Équipe actuellement engagée |
| `isOrganizer` | `boolean` | `false` | Affiche l'option "Aucune équipe" (organisateur peut se désengager) |

**Outputs**

| Nom | Type | Description |
|-----|------|-------------|
| `confirmed` | `number \| null` | `teamId` sélectionné, ou `null` pour se désengager |
| `cancelled` | `void` | Annulation |

---

### `CampaignProgram` — `campaigns/campaign-program/` 🧠

Gère le Programme Télé (mode campagne) dans `CampaignDetail`. Charge les parties et le catalogue de scénarios, gère l'ajout/édition (formulaire inline) et la suppression (confirmation). Toujours affiché par le parent ; la gestion (ajout/édition/suppression) est active en `EN_CONSTRUCTION`/`EN_COURS` et passe en lecture seule en `TERMINEE` (via `canManage`).

| | |
|---|---|
| **Sélecteur** | `app-campaign-program` |
| **Type** | Smart |
| **Services** | `CampaignsService` |
| **Compose** | `GameList`, `GameForm`, `GameResultWizard`, `ConfirmModal` |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `campaignId` | `number` | — | Campagne concernée |
| `isOrganizer` | `boolean` | `false` | Rôle organisateur (condition de gestion) |
| `campaignState` | `CampaignState` | — | État de la campagne ; `canManage` est faux en `TERMINEE` |

**Outputs**

| Nom | Type | Description |
|-----|------|-------------|
| `resultRecorded` | `void` | Émis après l'enregistrement réussi d'un résultat de partie — signale au parent que les PC ont changé, pour rafraîchir le classement affiché par `ParticipantList` (composant frère, sans lien direct) |

**Signals clés** : `games`, `scenarios`, `loading`, `showForm`, `editingGame`, `saving`, `pendingDeleteGame`, `canManage` (= `isOrganizer && campaignState !== 'TERMINEE'`).

---

### `GameList` — `campaigns/game-list/`

Liste ordonnée des parties du programme (numéro, scénario, badges type/statut). Émet les actions Modifier/Supprimer/Enregistrer, affichées uniquement pour les parties `PLANIFIE` gérables.

| | |
|---|---|
| **Sélecteur** | `app-game-list` |
| **Type** | Dumb |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `games` | `Game[]` | — | Parties, déjà triées par le backend |
| `canManage` | `boolean` | `false` | Organisateur hors `TERMINEE` — active Modifier/Supprimer |
| `canRecord` | `boolean` | `false` | Organisateur + campagne `EN_COURS` — active Enregistrer résultat |

**Outputs**

| Nom | Type | Description |
|-----|------|-------------|
| `editGame` | `Game` | Demande d'édition d'une partie |
| `deleteGame` | `Game` | Demande de suppression d'une partie |
| `recordGame` | `Game` | Ouvre le formulaire d'enregistrement de résultat |

---

### `GameForm` — `campaigns/game-form/`

Formulaire d'ajout ou d'édition d'une partie. Sélecteur de scénario ; le type est déduit du scénario. `effect()` pré-remplit en mode édition (`game` non nul).

| | |
|---|---|
| **Sélecteur** | `app-game-form` |
| **Type** | Dumb |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `scenarios` | `Scenario[]` | `[]` | Catalogue des scénarios pour le sélecteur |
| `saving` | `boolean` | `false` | Désactive les boutons pendant la sauvegarde |
| `game` | `Game \| null` | `null` | `null` = création, sinon pré-remplit (édition) |

**Outputs**

| Nom | Type | Description |
|-----|------|-------------|
| `saved` | `CreateGameDto` | `{ scenarioId }` validé (création ou édition) |
| `formCancel` | `void` | Annulation |

---

### `GameResultWizard` — `campaigns/game-result-wizard/`

Orchestrateur du wizard de fin de partie (remplace l'ancienne modale unique `GameResultForm`) — 3 écrans séquentiels : classement (`RankingStep`) → désignation des épaves (`WreckDesignationStep`) → résolution de la Table des Épaves (`WreckResolutionStep`). Affiché via `CampaignProgram` pour les parties `PLANIFIE` en `EN_COURS`. Document de conception : [`docs/plans/2026-07-04-wizard-fin-partie-design.md`](../plans/2026-07-04-wizard-fin-partie-design.md).

| | |
|---|---|
| **Sélecteur** | `app-game-result-wizard` |
| **Type** | Dumb |
| **Compose** | `RankingStep`, `WreckDesignationStep`, `WreckResolutionStep` |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `game` | `Game` | — | Partie dont on saisit le résultat |
| `participants` | `CampaignParticipant[]` | — | Participants `VALIDATED` de la campagne |
| `saving` | `boolean` | `false` | Désactive les boutons pendant `recordResult()` |
| `participantVehicles` | `ReadonlyMap<number, ParticipantVehicleDto[]>` | `new Map()` | Véhicules courants par participant (clé = `participantId`), pour l'écran 2 |
| `resultRecorded` | `Game \| null` | `null` | Non-null une fois `recordResult()` résolu — fait avancer le wizard vers l'écran 3 (`effect()`). La partie reste `PLANIFIE` à ce stade — la finalisation JOUE n'a lieu qu'à `wizardCompleted` |
| `wreckOutcomes` | `ReadonlyMap<number, WreckOutcomeDto>` | `new Map()` | Résultats de tirage reçus, clé = `vehicleId` |
| `wreckDescriptions` | `ReadonlyMap<number, string[]>` | `new Map()` | Lignes de texte décrivant les événements de chaque tirage (`GameEvent.describe()`), clé = `vehicleId` |
| `rollingWreck` | `boolean` | `false` | Verrou "un tirage à la fois" — consommé par l'`effect()` de déclenchement automatique de l'écran 3, plus par aucun bouton (il n'y en a plus) |
| `finalizingGame` | `boolean` | `false` | Désactive "Terminer" pendant l'appel à `finalizeGame()` |

**Outputs**

| Nom | Type | Description |
|-----|------|-------------|
| `presentParticipantsChanged` | `number[]` | Ids des présents à chaque changement (écran 1) — le parent recharge `participantVehicles` en réponse |
| `rankingSubmitted` | `RecordResultDto` | Classement + exploits validés, émis à la transition écran 2 → 3 |
| `wreckRollRequested` | `WreckResolveRequestDto` | Demande de tirage automatique, un véhicule à la fois (écran 3) — émis par un `effect()` interne, plus par un clic utilisateur |
| `wizardCompleted` | `void` | Le wizard est entièrement terminé (écran 3, "Terminer") — le parent appelle `finalizeGame()` à ce signal, **c'est le seul moment où la partie passe JOUE** |
| `formCancel` | `void` | Annulation (uniquement possible avant la soumission du classement) |

Reste un composant "dumb" au sens habituel (aucun appel HTTP direct) : `CampaignProgram` (smart) porte `recordResult()`, `resolveWreck()` et `finalizeGame()`, et repasse les résultats via `resultRecorded`/`wreckOutcomes`/`wreckDescriptions` — même pattern que `participantVehicles`/`presentParticipantsChanged` déjà en place. Calcule aussi `destroyedBy` (computed, à partir des `destroyedVehicles` capturés à l'écran 2) transmis à `WreckResolutionStep` pour afficher "Détruit par [participant]".

---

### `RankingStep` — `campaigns/game-result-wizard/ranking-step/`

Écran 1 du wizard : présence, ordre par glisser-déposer (CDK), portes franchies (exploit, US-B2). Inchangé dans son fonctionnement par rapport à l'ancien `GameResultForm`, simplement extrait en sous-composant dédié.

| | |
|---|---|
| **Sélecteur** | `app-ranking-step` |
| **Type** | Dumb |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `game` | `Game` | — | Fournit le type (barème PC) et le scénario |
| `participants` | `CampaignParticipant[]` | — | Source de la liste de présence |
| `saving` | `boolean` | `false` | Désactive les boutons pendant la sauvegarde |

**Outputs**

| Nom | Type | Description |
|-----|------|-------------|
| `next` | `RankingEntry[]` | Classement + portes franchies, une fois l'étape validée |
| `presentParticipantsChanged` | `number[]` | Ids des présents à chaque changement |
| `formCancel` | `void` | Annulation |

---

### `WreckDesignationStep` — `campaigns/game-result-wizard/wreck-designation-step/`

Écran 2 du wizard : pour chaque véhicule des équipes présentes, désigne s'il a été mis en épave (par un adversaire ou seul) et si un bonus "Favori du public" est en attente. C'est ici que se fait désormais la saisie "véhicules ennemis détruits" (US-B2), auparavant sur l'écran de classement.

| | |
|---|---|
| **Sélecteur** | `app-wreck-designation-step` |
| **Type** | Dumb |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `presentParticipants` | `CampaignParticipant[]` | — | Participants retenus à l'écran 1 |
| `participantVehicles` | `ReadonlyMap<number, ParticipantVehicleDto[]>` | `new Map()` | Véhicules courants par participant présent |
| `saving` | `boolean` | `false` | Désactive les boutons pendant `recordResult()` |

**Outputs**

| Nom | Type | Description |
|-----|------|-------------|
| `next` | `WreckDesignationResult` | `{ destroyedVehicles, wreckedVehicles }` — le premier alimente `RecordResultDto` (PC d'exploit), le second pilote l'écran 3 |
| `back` | `void` | Retour à l'écran 1 (rien n'est encore persisté) |
| `formCancel` | `void` | Annulation |

---

### `WreckResolutionStep` — `campaigns/game-result-wizard/wreck-resolution-step/`

Écran 3 du wizard : **synthèse automatique**, sans bouton ni sélecteur. Les tirages D6
sont déclenchés par `GameResultWizard` (un `effect()`, un véhicule à la fois) dès
l'arrivée sur cet écran ; ce composant se contente d'afficher, pour chaque véhicule
désigné à l'écran 2, un indicateur "en cours" puis le résultat reçu (Chocs, perte
d'équipement, lignes `descriptions`, "Détruit par [participant]" le cas échéant).
"Terminer" n'est actif que lorsque tous les véhicules ont un résultat ; son clic
déclenche la finalisation de la partie côté parent (`finalizeGame()`).

| | |
|---|---|
| **Sélecteur** | `app-wreck-resolution-step` |
| **Type** | Dumb |

**Inputs**

| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `wreckedVehicles` | `WreckedVehicleEntry[]` | — | Véhicules désignés à l'écran 2 |
| `vehicleLabels` | `ReadonlyMap<number, string>` | `new Map()` | Libellé "nom (équipe)" par véhicule, résolu par le parent |
| `destroyedBy` | `ReadonlyMap<number, string>` | `new Map()` | Libellé du destructeur par véhicule détruit (si applicable), résolu par le parent |
| `outcomes` | `ReadonlyMap<number, WreckOutcomeDto>` | `new Map()` | Résultats reçus, clé = `vehicleId` |
| `descriptions` | `ReadonlyMap<number, string[]>` | `new Map()` | Lignes de texte décrivant les événements de chaque tirage (`GameEvent.describe()`) |
| `finalizing` | `boolean` | `false` | Désactive "Terminer" pendant l'appel à `finalizeGame()` |

**Outputs**

| Nom | Type | Description |
|-----|------|-------------|
| `completed` | `void` | Clic sur "Terminer" (uniquement si tous les véhicules ont un résultat) |

---

## Domaine Admin

### `AdminUsers` — `admin/users/` 🧠

Page de gestion des utilisateurs, réservée aux administrateurs (`/admin/users`). Liste tous les comptes avec toggle actif/inactif et suppression. Masque les actions sur le compte connecté.

| | |
|---|---|
| **Sélecteur** | `app-admin-users` |
| **Type** | Smart |
| **Route** | `/admin/users` |
| **Services** | `UsersService`, `AuthService` |
| **Compose** | `ConfirmModal` |

**Signals clés** : `users`, `loading`, `error`, `pendingDeleteUser`.
