# Navigation et backlog

> Sous-document de [SPECIFICATION.md](../SPECIFICATION.md). Mettre à jour après tout ajout de route
> ou de fonctionnalité au backlog.

---

## Routes de l'application

| Route | Accès | Écran |
|---|---|---|
| `/home` | public | accueil |
| `/documentation`, `/documentation/:slug` | public | documentation utilisateur (sommaire, chapitre) |
| `/vehicles`, `/weapons` | public | placeholders (backlog) |
| `/login`, `/register` | public | connexion, inscription |
| `/teams` | JWT | mes équipes |
| `/teams/:id/edit` | JWT | édition d'une équipe et de ses véhicules |
| `/teams/:teamId/vehicles/new`, `/teams/:teamId/vehicles/:vehicleId` | JWT | création / équipement d'un véhicule |
| `/campaigns` | JWT | mes campagnes, participations, demandes |
| `/campaigns/join/:code` | JWT | rejoindre par code |
| `/campaigns/:id` | JWT | détail d'une campagne et Programme Télé |
| `/campaigns/:id/atelier` | JWT | atelier : véhicules de mon équipe engagée |
| `/campaigns/:id/atelier/vehicles/:vehicleId` | JWT | atelier : équipement d'un véhicule |
| `/campaigns/:id/participants/:pid/atelier` | JWT | atelier d'un autre participant, lecture seule |
| `/admin/users` | JWT + `adminGuard` | gestion des comptes |

Comportement de chaque écran : [CAMPAIGN.md](CAMPAIGN.md), [TEAMS.md](TEAMS.md), [AUTH.md](AUTH.md).

---

## Contenu Markdown

Servi converti en HTML par `ContentController` (`apps/backend/src/app/content/`) :

- **Pages de référence isolées** (`content/*.md`) : `GET /api/content` (slugs) et `GET /api/content/:slug`,
  disponibles sans redémarrage. Aujourd'hui `vehicules.md`/`armes.md`, non branchés à une route
  (réservés au backlog ci-dessous).
- **Documentation utilisateur** (`content/docs/*.md`) : ci-dessous.

---

## Documentation utilisateur

Documente le **fonctionnement de l'application** (équipes, construction, campagnes, Programme Télé,
atelier, séquelles), pas les règles du jeu supposées connues. Conception :
[`docs/plans/2026-07-16-documentation-utilisateur-design.md`](../plans/2026-07-16-documentation-utilisateur-design.md).

- **Chapitres** : `content/docs/*.md` ; ordre et titres dans `content/docs/manifest.yml`, chargé au
  démarrage par `DocsService`. Le contenu est relu à chaque requête (correction sans redémarrage).
- **Ancres** : `DocsService` ajoute un `id` slugifié (sans accents) à chaque titre - `marked` n'en génère
  plus - pour les liens `#section`, y compris d'un chapitre à l'autre.
- **Navigation sans rechargement** : `DocLinksDirective` intercepte les liens `/documentation/<slug>` du
  HTML injecté.
- **Aide contextuelle** : une route qui porte `data: { docSlug }` fait apparaître dans la navbar le lien
  « Aide sur cet écran » vers ce chapitre.

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/content/docs` | sommaire ordonné `{ slug, title }[]` |
| GET | `/api/content/docs/:slug` | HTML + titre d'un chapitre |

---

## Backlog

- **Catalogue dynamique** : remplacer `/vehicles` et `/weapons` par une vue issue de `/api/catalog/`, filtrable par sponsor.
- **Tableau de bord** : vue d'ensemble des équipes de l'utilisateur, accès rapide à chaque équipe.
- **Lancement de partie** : cf. [CAMPAIGN.md](CAMPAIGN.md#limitations-connues).
