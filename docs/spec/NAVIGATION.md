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
| `/seasons` | JWT | Liste des saisons (organisées, participations, demandes en attente) (**implémenté**) |
| `/seasons/join/:code` | JWT | Rejoindre une saison via son code d'invitation (**implémenté**) |
| `/seasons/:id` | JWT | Détail d'une saison (**implémenté**) |
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
