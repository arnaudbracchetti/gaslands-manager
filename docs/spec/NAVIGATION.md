# Navigation & Backlog

> Sous-document de [SPECIFICATION.md](../SPECIFICATION.md).
> Mettre à jour après tout ajout de route ou de fonctionnalité au backlog.

---

## Routes de l'application

| Route | Accès | État |
|-------|-------|------|
| `/home` | Public | Page d'accueil avec présentation et liens vers les sections |
| `/documentation` | Public | Documentation utilisateur — sommaire (intro + liste des chapitres, **implémenté**) |
| `/documentation/:slug` | Public | Documentation utilisateur — un chapitre (**implémenté**, cf. §Documentation utilisateur ci-dessous) |
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
| `/admin/users` | JWT + admin (`adminGuard`) | Gestion des comptes utilisateurs — lister, activer/désactiver, supprimer (**implémenté**, cf. [AUTH.md](AUTH.md#administration-des-comptes)) |

---

## Contenu Markdown statique

Deux mécanismes distincts servent du Markdown converti en HTML, tous deux
via `ContentController` (`apps/backend/src/app/content/`) :

- **Pages de référence isolées** (`content/*.md`, à plat) : `vehicules.md` et
  `armes.md` — non branchés à une route aujourd'hui (réservés au backlog
  §Frontend — Consultation du catalogue ci-dessous, cf. `ContentService`).
- **Documentation utilisateur** (`content/docs/*.md`, ordonnée) — voir
  section dédiée ci-dessous (`DocsService`).

Pour ajouter une page de référence isolée : créer `content/<slug>.md` →
disponible immédiatement via `GET /api/content/<slug>`, sans redémarrer le
backend (aucune route frontend ne consomme ce mécanisme actuellement).

API Endpoints Contenu (pages de référence isolées) :

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/content` | Non | Liste des slugs disponibles |
| GET | `/api/content/:slug` | Non | Contenu HTML + titre |

---

## Documentation utilisateur

Remplace l'ancienne page `/rules` (règles du jeu Gaslands, sourcées du
livre) : documente désormais le **fonctionnement de l'application**
elle-même — équipes, construction de véhicule, campagnes, Programme Télé,
Atelier, Chocs et Séquelles — pas les règles du jeu de plateau, supposées
déjà connues du lecteur. Conception complète :
[`docs/plans/2026-07-16-documentation-utilisateur-design.md`](../plans/2026-07-16-documentation-utilisateur-design.md).

- **Chapitres** (`content/docs/*.md`) : `index` (intro, hors sommaire),
  `equipes`, `construction-vehicule`, `campagnes`, `programme-tele`,
  `atelier`, `sequelles` — ordre et titres canoniques dans
  `content/docs/manifest.yml`, chargé une seule fois au démarrage par
  `DocsService` (pattern singleton en mémoire, même famille que
  `CatalogService`/`ScenarioCatalogService`, cf. ARCHITECTURE.md §3.3). Le
  contenu de chaque chapitre, lui, est relu à chaque requête — pas de
  redémarrage nécessaire pour corriger une phrase.
- **Ancres internes** : chaque titre du HTML rendu reçoit un `id` slugifié
  (accents retirés) ajouté par `DocsService`, `marked` (v18) n'en générant
  plus par défaut — permet des liens `#section`, y compris depuis un autre
  chapitre (ex. `/documentation/atelier#table-des-epaves`).
- **Navigation fluide** : les liens internes entre chapitres, écrits en dur
  dans le Markdown source (`/documentation/<slug>`), sont interceptés par
  `DocLinksDirective` (délégation d'événement sur le conteneur `[innerHTML]`)
  pour naviguer via le Router Angular sans rechargement de page — un `<a>`
  injecté en HTML brut n'est sinon jamais reconnu par `routerLink`.
- **Aide contextuelle** : les routes concernées de `app.routes.ts` portent
  `data: { docSlug: '<slug>' }` ; le shell global (`app.ts`/`app.html`, déjà
  rendu sur tout écran) en déduit le lien "❓ Aide sur cet écran" de la
  navbar, pointant directement sur le chapitre pertinent — sans qu'aucun
  composant d'écran n'ait à le savoir lui-même.

API Endpoints Contenu (documentation utilisateur) :

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/api/content/docs` | Non | Sommaire ordonné (`{slug, title}[]`) |
| GET | `/api/content/docs/:slug` | Non | Contenu HTML + titre d'un chapitre |

---

## Backlog — Fonctionnalités à implémenter

### Frontend — Consultation du catalogue

- Remplacer les pages `/vehicles` et `/weapons` (actuellement placeholders Markdown) par une vue dynamique depuis l'API `/api/catalog/`
- Permettre de filtrer par sponsor pour voir uniquement les items autorisés

### Tableau de bord

- Vue d'ensemble de toutes les équipes de l'utilisateur
- Accès rapide à chaque équipe et ses véhicules

