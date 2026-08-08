# Gaslands Manager — Couverture e2e & helpers (document vivant)

> **Document vivant** : ce fichier recense l'état courant de la couverture e2e
> (`apps/frontend-e2e/src/*.spec.ts`) et des helpers partagés (`support/*.ts`). Il
> évolue à chaque ajout/suppression de spec ou de helper — le skill Claude Code
> `e2e-testing` le tient à jour lui-même à chaque nouveau test généré (branche `new`,
> cf. `.claude/skills/e2e-testing/WRITING.md` §"Après avoir écrit le test"). Si vous
> ajoutez un spec ou un helper manuellement (sans passer par le skill), mettez ce
> fichier à jour au même titre que le code.
>
> Pour tout le reste — commandes, prérequis d'environnement, infrastructure technique,
> pièges, troubleshooting, cadre de décision e2e-vs-unitaire — voir le skill
> `e2e-testing` (`.claude/skills/e2e-testing/SKILL.md`, `RUNNING.md`, `WRITING.md`).

---

## Carte de couverture (`apps/frontend-e2e/src/*.spec.ts`)

Vérifier ici avant d'écrire un nouveau spec - étendre un scénario existant plutôt que de
dupliquer une inscription/création de campagne complète.

| Spec | Couvre |
|---|---|
| `teams.spec.ts` | Pilote CRUD équipe/véhicule (création, renommage, sponsor/description/budget, verrouillage sponsor, suppression équipe/véhicule en cascade) - preuve de concept du harnais entier |
| `vehicle-equipment.spec.ts` | Armes/améliorations, cas particulier de la Tourelle (assignation/désassignation/retrait, coût ×3), garde de budget |
| `sponsor-catalog.spec.ts` | Filtrage du catalogue véhicules/armes par sponsor |
| `campaign-program.spec.ts` | Pilote campagne - création (équipe engagée dès la création), ajout d'une partie au Programme Télé, wizard de fin de partie (Événement Télévisé) en bout en bout via `runResultWizard` (présence → écrans intermédiaires variables → désignation des épaves → résolution automatique de la Table des Épaves → "Terminer"), vérification `PLANIFIE → ATELIER` |
| `campaign-participants.spec.ts` | Invitation/validation/refus/promotion (2 contextes navigateur) ; budget de campagne - équipe hors budget grisée (`disabled`, mention "hors budget") dans `ChangeTeamModal` et dans le select de `/campaigns/join/:code`, sélection automatique de la première équipe éligible, soumission bloquée sur une équipe hors budget ; modification nom/budget d'une saison `EN_CONSTRUCTION` (`EditCampaignModal`) - refus serveur si le budget rendrait une équipe déjà engagée hors budget (modale reste ouverte, erreur inline), succès (en-tête mis à jour sans reload, persiste après rechargement) |
| `campaign-wreck-designation.spec.ts` | Écran de désignation des épaves (véhicules réels) |
| `campaign-escarmouche.spec.ts` | Wizard de fin de partie — parcours **Escarmouche** de bout en bout (scénario "Pillage de Convoi", `gain_jerricans`) : Présence → Jerricans directement (ni Classement ni Portes) → Désignation vide → revenu de base D6 par participant à l'écran Résolution → `PLANIFIE → ATELIER` ; + "Annuler" à l'écran Résolution déclenche `DELETE .../results` et laisse la partie ré-ouvrable à l'état vierge |
| `campaign-atelier.spec.ts` | Boutique atelier - cagnotte dérivée, achat/annulation/revente |
| `campaign-atelier-sequella.spec.ts` | Séquelles en atelier - limité au cas déterministe (chocs=0) |
| `campaign-journal.spec.ts` | `GameJournalModal`, accessible à tout participant validé |
| `example.spec.ts` | Scaffold d'origine (titre de la page d'accueil) |

`backend-e2e` : un seul fichier, `src/backend/backend.spec.ts`.

## Helpers partagés (`apps/frontend-e2e/src/support/`)

| Fichier | Rôle |
|---------|------|
| `auth.ts` | `registerTestUser()`/`login()` - un utilisateur frais par test, isolation garantie |
| `teams.ts` | `createTeam`, `setSponsor`, `addVehicle`, `createTeamWithVehicles`, `openEquipmentManager`, `optionCard`, `saveAndWait` (attend la réponse `PUT /api/teams/:id` avant tout `page.reload()` - nécessaire car `TeamEditPage.saveField()` sauvegarde au blur sans aucun signal visuel de fin d'écriture) |
| `campaigns.ts` | `createCampaign` (accepte `budget?` - jerricans, défaut 50 côté formulaire), `addGame`, `completePreDesignationSteps` (coche la présence puis avance à travers les écrans intermédiaires à étapes variables - Classement/Portes/Jerricans selon le type de partie et le scénario - jusqu'à l'écran Désignation, via un `waitFor` borné plutôt qu'un `.count()` instantané, pour éviter une course avec le re-rendu Angular après chaque clic "Suivant"), `runResultWizard` (délègue à `completePreDesignationSteps`), `designateWreck`, `waitForEquipmentEvent`, `openAtelier`, `inviteAndValidateParticipant`, `addBystanderParticipant` (invite un second participant "figurant" sans véhicule, uniquement pour satisfaire le minimum de deux équipes présentes exigé par l'écran Présence du wizard depuis `PresenceStep` - une partie à un seul participant n'est plus enregistrable ; délégation à `inviteAndValidateParticipant` avec une identité fixe, retourne `{ teamName, context }`, `context.close()` à appeler en fin de test) |
| `db.ts` | Crée `gaslands_test` si absente, puis vide (`TRUNCATE ... CASCADE`) toutes les tables applicatives - état propre garanti à chaque run |
| `backend-process.ts` | `spawn`/`kill` d'un backend dédié avec `DATABASE_NAME=gaslands_test`, `PORT=3000` ; attend un healthcheck (`GET /api/catalog/sponsors`) avant de rendre la main |
| `global-setup.ts` | Orchestre `db.ts` puis `backend-process.ts`, dans cet ordre précis |
| `global-teardown.ts` | Arrête le backend de test en fin de run |

## `data-testid` ajoutés

Deux `data-testid` ajoutés pour fiabiliser des sélecteurs autrement ambigus (Teams/
Vehicles) : `tam-weapon-{nomInterne}` (`tourelle-assignment-modal.html`) et
`vehicle-card-manage`/`vehicle-card-delete` (`vehicle-summary-card.html`). **Aucun
`data-testid`** dans les templates Campaigns : sélecteurs par rôle/label/texte français
exact - ex. bouton "Enregistrer" nécessitant `exact: true` pour ne pas matcher
"Enregistrement...".
