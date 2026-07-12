# Navigation & Backlog

> Sous-document de [SPECIFICATION.md](../SPECIFICATION.md).
> Mettre à jour après tout ajout de route ou de fonctionnalité au backlog.

---

## Routes de l'application

| Route | Accès | État |
|-------|-------|------|
| `/home` | Public | Page d'accueil avec présentation et liens vers les sections |
| `/rules` | Public | Affichage des règles du jeu (Markdown → HTML) |
| `/vehicles` | Public | Page véhicules (placeholder) |
| `/weapons` | Public | Page armes (placeholder) |
| `/teams` | JWT | Gestion des équipes (**implémenté**) |
| `/teams/:teamId/vehicles/new` | JWT | Construction d'un nouveau véhicule, page dédiée (**implémenté**) |
| `/teams/:teamId/vehicles/:vehicleId` | JWT | Gestion de l'équipement d'un véhicule existant, page dédiée (**implémenté**) |
| `/campaigns` | JWT | Liste des campagnes (organisées, participations, demandes en attente) (**implémenté**) |
| `/campaigns/join/:code` | JWT | Rejoindre une campagne via son code d'invitation (**implémenté**) |
| `/campaigns/:id` | JWT | Détail d'une campagne — inclut la section **Programme Télé** (visible dans tous les états ; gérable en `EN_CONSTRUCTION`/`EN_COURS`, lecture seule en `TERMINEE`) (mode campagne, **implémenté**) |
| `/campaigns/:id/atelier` | JWT | **Atelier** (phase garage post-partie) — liste des véhicules de l'équipe engagée (cartes façon `TeamEditPage`, sans suppression). Accessible via le bouton 🔧 Atelier d'une partie en `ATELIER` (mode campagne — Temps 1, **implémenté**) |
| `/campaigns/:id/atelier/vehicles/:vehicleId` | JWT | Configuration d'équipement d'un véhicule d'atelier — réutilise `EquipmentManager` (même composant que côté équipe) via `AtelierEquipmentDataSource` ; achat/retrait armes + améliorations depuis la cagnotte. Atteinte depuis la liste ci-dessus (mode campagne — Temps 1, **implémenté**). La liste elle-même permet en plus l'achat d'un nouveau véhicule et la vente/annulation d'un véhicule existant (cf. [CAMPAIGN.md](CAMPAIGN.md#annulation-dachat-vs-revente)) |
| `/login` | Public | Page de connexion |
| `/register` | Public | Page d'inscription |

---

## Contenu Markdown statique

Les pages informatives sont servies depuis des fichiers `.md` du dossier `content/` :

| Slug | Fichier | Contenu |
|------|---------|---------|
| `regles` | `content/regles.md` | Règles générales du jeu, notion de sponsor et de budget |
| `vehicules` | `content/vehicules.md` | Types de véhicules disponibles et leurs caractéristiques |
| `armes` | `content/armes.md` | Armes disponibles et leurs statistiques |

Le backend convertit le Markdown en HTML (`marked`) et l'expose via `GET /api/content/:slug`. Le frontend affiche ce HTML brut via `[innerHTML]` dans le composant `Rules`.

Pour ajouter du contenu : créer `content/<slug>.md` → disponible immédiatement sans redémarrer le backend.

API Endpoints Contenu :

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/content` | Non | Liste des slugs disponibles |
| GET | `/api/content/:slug` | Non | Contenu HTML + titre |

---

## Backlog — Fonctionnalités à implémenter

### Frontend — Consultation du catalogue

- Remplacer les pages `/vehicles` et `/weapons` (actuellement placeholders Markdown) par une vue dynamique depuis l'API `/api/catalog/`
- Permettre de filtrer par sponsor pour voir uniquement les items autorisés

### Tableau de bord

- Vue d'ensemble de toutes les équipes de l'utilisateur
- Accès rapide à chaque équipe et ses véhicules

### Export (futur)

- Fiche récapitulative d'une équipe au format imprimable (HTML/PDF)
