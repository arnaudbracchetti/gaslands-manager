# Gaslands Manager - Spécifications fonctionnelles

> Index : contexte, état des fonctionnalités, table des matières. Une ligne par domaine ; le détail
> vit dans le sous-document lié. Mettre à jour après tout ajout de sous-document ou changement de statut.

**Gaslands Manager** gère les équipes du jeu de plateau **Gaslands** (course post-apocalyptique,
véhicules armés, sponsors aux règles propres). Projet pédagogique : le code est commenté pour
expliquer les choix techniques.

---

## Fonctionnalités

| Domaine | État | Détail |
|---|---|---|
| Authentification, rôles, compte admin, usurpation | ✅ | [AUTH.md](spec/AUTH.md) |
| Catalogue de jeu en mémoire (13 sponsors, 22 véhicules, 38 armes, 19 améliorations, 72 avantages, 12 séquelles) | ✅ | [VEHICLES.md](spec/VEHICLES.md) |
| Équipes (CRUD, verrouillage sponsor et campagne) | ✅ | [TEAMS.md](spec/TEAMS.md) |
| Construction de véhicule (armes, améliorations, avantages, tourelle, budget) | ✅ | [VEHICLES.md](spec/VEHICLES.md#construction-dun-véhicule) |
| Fiche d'équipe exportable (HTML imprimable, page Équipe et page Campagne) | ✅ | [TEAMS.md](spec/TEAMS.md#fiche-déquipe-exportable) |
| Campagnes (inscriptions, transitions d'état, budget de campagne) | ✅ | [CAMPAIGN.md](spec/CAMPAIGN.md) |
| Programme Télé (parties, scénarios, réordonnancement) | ✅ | [CAMPAIGN.md](spec/CAMPAIGN.md#programme-télé) |
| Wizard de fin de partie (classement, exploits, sabotage, jerricans, épaves) | ✅ | [CAMPAIGN.md](spec/CAMPAIGN.md#wizard-de-fin-de-partie) |
| Table des Épaves, Faveur du Public, séquelles | ✅ | [CAMPAIGN.md](spec/CAMPAIGN.md#table-des-épaves) |
| Règles maison (R1 à R4) | ✅ | [CAMPAIGN.md](spec/CAMPAIGN.md#règles-maison) |
| Atelier (achat, revente, annulation, véhicules, séquelles) | 🟡 règles de pose non revérifiées à l'écriture, pas de limite de 8 véhicules | [CAMPAIGN.md](spec/CAMPAIGN.md#limitations-connues) |
| Points de Résistance / sabotage | 🟡 crédit et dépense implémentés, total brut volontairement jamais visible | [CAMPAIGN.md](spec/CAMPAIGN.md#points-de-sabotage) |
| Lancement de partie (Votes du Public, fermeture de l'atelier) | 🔲 | [CAMPAIGN.md](spec/CAMPAIGN.md#limitations-connues) |
| Documentation utilisateur `/documentation` | ✅ | [NAVIGATION.md](spec/NAVIGATION.md#documentation-utilisateur) |
| Pages catalogue dynamiques `/vehicles`, `/weapons` ; tableau de bord | 🔲 | [NAVIGATION.md](spec/NAVIGATION.md#backlog) |

---

## Table des matières

| Sous-document | Contenu |
|---|---|
| [spec/AUTH.md](spec/AUTH.md) | rôles, JWT, nom d'affichage, compte admin, administration des comptes |
| [spec/TEAMS.md](spec/TEAMS.md) | CRUD équipes, verrouillages, fiche d'équipe, modèle `Team` |
| [spec/VEHICLES.md](spec/VEHICLES.md) | catalogue, construction de véhicule, règles Gaslands, modèles `Vehicle`/`Weapon`/… |
| [spec/CAMPAIGN.md](spec/CAMPAIGN.md) | campagnes, Programme Télé, wizard, atelier, règles maison, modèles |
| [spec/NAVIGATION.md](spec/NAVIGATION.md) | routes Angular, contenu Markdown, backlog |
| [DOMAIN_MODEL.md](DOMAIN_MODEL.md) | conception du domaine, diagrammes UML, ERD |
