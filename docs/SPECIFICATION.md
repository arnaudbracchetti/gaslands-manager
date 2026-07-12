# Gaslands Manager — Spécifications fonctionnelles

> Index de la spécification. Lire ce fichier pour le contexte général, puis naviguer
> vers le sous-document thématique pertinent. Mettre à jour l'index après tout ajout
> de sous-document ou changement de périmètre.

---

## Présentation du projet

**Gaslands Manager** est une application web permettant aux joueurs de gérer leurs équipes pour le jeu de plateau **Gaslands** — un jeu de course automobile post-apocalyptique avec des véhicules armés et des sponsors aux règles spécifiques.

**Objectif pédagogique** : ce projet sert de support d'apprentissage. Chaque composant est commenté pour expliquer les choix techniques (Angular Signals, NestJS modules, TypeORM, JWT…).

---

## Fonctionnalités — vue d'ensemble

| Domaine | État |
|---------|------|
| Authentification (inscription, connexion, JWT, compte admin) | ✅ Implémenté |
| Catalogue de jeu en mémoire (sponsors, véhicules, armes, améliorations) | ✅ Implémenté |
| CRUD Équipes (création, édition, suppression, verrouillage sponsor) | ✅ Implémenté |
| Construction de véhicule (choix, équipement armes/améliorations, budget) | ✅ Implémenté |
| Campagnes (ligue, inscriptions, validation, transitions d'état) | ✅ Implémenté |
| Mode campagne — Programme Télé (parties planifiées, catalogue de scénarios) | ✅ Implémenté (US-A1/A2/A3) |
| Mode campagne — Résultats & classement (rang, PC de classement 10/5/2/1) | ✅ Implémenté (US-B1/B3/C1) |
| Mode campagne — Exploits de partie (portes franchies, véhicules ennemis détruits) | ✅ Implémenté (US-B2) |
| Mode campagne — Atelier (cagnotte, achat/revente d'équipement) | 🟡 Partiel — **UI Temps 1 implémentée** (page `/campaigns/:id/atelier` réutilisant `EquipmentManager` : achat/retrait armes + améliorations + avantages via la cagnotte, y compris le montage sur Tourelle — attribut de l'arme, cf. [spec/VEHICLES.md](spec/VEHICLES.md#montage-sur-tourelle-attribut-de-larme)). Revente à moitié prix (perte totale pour un avantage) et annulation d'achat vs revente **implémentées** (cf. [spec/CAMPAIGN.md](spec/CAMPAIGN.md#annulation-dachat-vs-revente)). Restent en Temps 2 : enforcement des règles au write, gardes sponsor/limite 8, UI chocs/séquelles/épaves (cf. [design](plans/2026-07-07-atelier-reutilisation-configurateur-design.md)) |
| Catalogue Avantages de véhicule (72, 12 catégories) | ✅ Implémenté — cf. [spec/VEHICLES.md](spec/VEHICLES.md#avantages-de-véhicule-72-au-total) |
| Mode campagne — Table des Épaves (D6 serveur, 9 lignes, pertes aléatoires) | ✅ Implémenté (US-E1–E3) — 🟡 séquelles spéciales absentes (Maintenu par la Rouille, Légende Vivante) |
| Mode campagne — Points de Résistance (mécanique secrète) | 🟡 Partiel — crédit automatique implémenté (US-F1), aucune lecture possible par le joueur lui-même |
| Mode campagne — Wizard de fin de partie (classement → épaves → Table des Épaves) | ✅ Implémenté — remplace l'ancienne modale unique |
| Catalogue dynamique pages `/vehicles` et `/weapons` | 🔲 Backlog |
| Tableau de bord utilisateur | 🔲 Backlog |
| Export fiche d'équipe (HTML/PDF) | 🔲 Backlog |

---

## Table des matières

| Sous-document | Contenu |
|---------------|---------|
| [spec/AUTH.md](spec/AUTH.md) | Rôles utilisateur, authentification JWT, compte administrateur, modèle `User`, endpoints `/api/auth` |
| [spec/TEAMS.md](spec/TEAMS.md) | CRUD équipes, verrouillage du sponsor, résumé véhicules sur la carte, modèle `Team`, endpoints `/api/teams` |
| [spec/VEHICLES.md](spec/VEHICLES.md) | Catalogue de jeu (sponsors, véhicules, armes, améliorations), construction/équipement d'un véhicule, règles métier Gaslands (budget, emplacements, améliorations par défaut), modèles `Vehicle`/`Weapon`/`VehicleImprovement`, endpoints catalogue et véhicules |
| [spec/CAMPAIGN.md](spec/CAMPAIGN.md) | Cycle de vie d'une campagne, inscriptions, transitions de statut, écran détail, Programme Télé, modèles `Campaign`/`CampaignParticipant`/`Game`, endpoints `/api/campaigns` |
| [spec/NAVIGATION.md](spec/NAVIGATION.md) | Table des routes Angular, contenu Markdown statique, backlog des fonctionnalités à venir |
| [DOMAIN_MODEL.md](DOMAIN_MODEL.md) | Diagrammes UML Mermaid : agrégat Team (DDD), catalogue en mémoire, ERD global |
