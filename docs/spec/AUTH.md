# Authentification et rôles

> Sous-document de [SPECIFICATION.md](../SPECIFICATION.md). Conception de l'agrégat `User` :
> [DOMAIN_MODEL.md §1 bis](../DOMAIN_MODEL.md#1-bis-agrégat-user).

---

## Nom d'affichage (`callName`)

Chaque utilisateur a un **pseudo** obligatoire, **non unique** (l'email est l'identifiant). C'est le seul
nom affiché partout où l'application montre qui est quelqu'un (navbar, participants, journal,
organisateur, fiche d'équipe). Prénom et nom ne sont visibles que sur les écrans de compte
(inscription, détails du compte, administration).

- La règle « quel nom afficher » est portée par **un seul** getter, `User.callName` (aujourd'hui le
  pseudo tel quel). Personne ne lit `pseudo` pour afficher : faire évoluer la règle ne touche que ce getter.
- Toute réponse exposant un utilisateur porte `pseudo` (brut, pour pré-remplir le formulaire) **et**
  `callName` (pour l'affichage) - même couple que `Vehicle.customName`/`nom`. `callName` doit être
  matérialisé par le mapper HTTP (`user-http.mapper.ts`) : un getter n'est pas sérialisé par `JSON.stringify`.

---

## Rôles

| Rôle | Accès |
|---|---|
| Visiteur | accueil, documentation, pages publiques |
| Utilisateur (`user`) | + ses propres équipes, véhicules, campagnes |
| Administrateur (`admin`) | + administration des comptes ; compte unique créé au démarrage |

Chaque utilisateur ne voit et ne modifie que ses propres données.

---

## Authentification

- **Inscription** (`POST /api/auth/register`) : prénom, nom, pseudo, email, mot de passe (≥ 6 caractères).
- **Connexion** (`POST /api/auth/login`) : vérification bcrypt, JWT émis ; message d'erreur générique.
- **Session** : token dans `localStorage`, restauré au démarrage par `GET /api/auth/me`.
- **Déconnexion** : suppression du token, redirection `/login`.
- `authGuard` protège les routes privées, `authInterceptor` ajoute l'en-tête `Authorization`.

---

## Auto-édition du profil

Menu ouvert au clic sur son pseudo (navbar), deux entrées indépendantes :

- **« Détails du compte »** (`PATCH /api/auth/me`) : prénom, nom, pseudo brut, email. Email revérifié
  unique (409 si déjà pris). Le rôle n'est ni affiché ni modifiable (`User._role` est `readonly`). La
  réponse remplace directement l'utilisateur courant du frontend.
- **« Changer le mot de passe »** (`PATCH /api/auth/me/password`) : exige le mot de passe actuel, même
  règle de longueur. **Après succès, l'utilisateur est déconnecté** : sans révocation JWT, se reconnecter
  est le seul moyen de garantir qu'aucune session ne reste ouverte avec l'ancien mot de passe.

---

## Compte administrateur

Au démarrage, `AdminSeedService` garantit un **unique** utilisateur `admin` :
- aucun admin en base → création avec `ADMIN_EMAIL`/`ADMIN_PASSWORD` (`.env`) et le pseudo `"Admin"` ;
- un admin existe → email et mot de passe resynchronisés s'ils ont changé dans `.env` (warning loggé,
  effet au redémarrage) ;
- recherche par `role: admin`, jamais par email : un seul admin quoi que contienne `.env` ;
- `register` ne peut jamais créer d'admin (`role` absent de `RegisterDto`, défaut `user` en base).

---

## Administration des comptes

Réservée au rôle `admin` par un vrai contrôle : `UsersController` porte `JwtAuthGuard` + `RolesGuard` +
`@Roles(ADMIN)` (403 sinon) ; la route `/admin/users` a `adminGuard` (redirection `/home`).
L'agrégat interdit à l'admin de se supprimer, se désactiver ou réinitialiser son propre mot de passe par
ces actions (403) - il a « Changer le mot de passe » pour lui-même.

### Suppression d'un compte engagé comme organisateur de campagne

`RemoveUserUseCase` refuse (400, campagnes citées) une suppression qui laisserait une campagne sans
organisateur `VALIDATED` - elle ne pourrait plus jamais être administrée. Règle cross-agrégat (`User` ne
connaît pas les campagnes), donc dans le use case, via
`ICampaignRepository.findCampaignsWhereSoleValidatedOrganizer`. Pendant d'`assertNotLastOrganizer`
([CAMPAIGN.md](CAMPAIGN.md#inscription)). Pour débloquer : usurper le compte (ou un autre organisateur)
et promouvoir un remplaçant.

### Usurpation d'identité ("se connecter en tant que")

Depuis le menu ⋯ d'un compte `user`, l'admin obtient un JWT valide pour ce compte sans son mot de passe
(`POST /api/users/:id/impersonate`).
- Jamais pour un admin ni un compte désactivé (`User.assertImpersonatableBy`, 403).
- Le token est émis comme au login, **sans marque** : la session est indiscernable d'une vraie connexion
  (aucune autorisation n'est modifiée). L'état « usurpation » est purement frontend.
- Pas de journal d'audit (un seul admin dans ce projet).
- Frontend : le token admin est sauvegardé sous une clé `localStorage` dédiée ; une bannière permanente
  propose « Revenir à mon compte » (restaure le token, recharge `/me`, retour à `/admin/users`).
  `logout()` efface aussi cette sauvegarde.

---

## Modèle de données - `User`

| Champ | Type | Contraintes |
|---|---|---|
| `id` | number | PK, auto-incrémenté |
| `firstName` / `lastName` | string | obligatoires |
| `pseudo` | string(100) | obligatoire, non unique ; colonne `default: ''` (seuls des comptes antérieurs à la colonne peuvent valoir `''`) |
| `email` | string | obligatoire, unique |
| `password` | string | hash bcrypt, champ privé de l'agrégat, absent de toute réponse |
| `role` | `user \| admin` | défaut `user` |
| `isActive` | boolean | compte désactivable par l'admin |
| `createdAt` / `updatedAt` | Date | auto |

Calculé : `callName` (cf. ci-dessus).

---

## API Endpoints

| Méthode | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | - | inscription (400 si champ manquant ou mot de passe < 6) |
| POST | `/api/auth/login` | - | connexion, renvoie le JWT |
| GET | `/api/auth/me` | JWT | utilisateur courant |
| PATCH | `/api/auth/me` | JWT | profil (409 si email pris) |
| PATCH | `/api/auth/me/password` | JWT | mot de passe (actuel requis) |
| GET | `/api/users` | admin | liste des comptes |
| DELETE | `/api/users/:id` | admin | supprimer (403 soi-même, 400 si campagne orpheline) |
| PATCH | `/api/users/:id/active` | admin | activer/désactiver (403 soi-même) |
| PATCH | `/api/users/:id/password` | admin | réinitialiser (403 soi-même) |
| POST | `/api/users/:id/impersonate` | admin | JWT du compte (403 si admin ou désactivé) |
