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
| Saisons (ligue, inscriptions, validation, transitions d'état) | ✅ Implémenté |
| Mode campagne — Programme Télé (parties planifiées, catalogue de scénarios) | ✅ Implémenté (US-A1) |
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
| [spec/SEASONS.md](spec/SEASONS.md) | Cycle de vie d'une saison, inscriptions, transitions de statut, écran détail, modèles `Season`/`SeasonParticipant`, endpoints `/api/seasons` |
| [spec/NAVIGATION.md](spec/NAVIGATION.md) | Table des routes Angular, contenu Markdown statique, backlog des fonctionnalités à venir |
