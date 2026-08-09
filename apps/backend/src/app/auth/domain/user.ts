import { DomainException } from '../../shared/domain/domain-exception';
import type { IPasswordHasher } from './password-hasher.interface';
import { UserRole } from './user-role';

/** Longueur minimale d'un mot de passe, à l'inscription comme au changement. */
const MIN_PASSWORD_LENGTH = 6;

/** Commande d'inscription — mot de passe encore en clair à ce stade. */
export interface RegisterUserCommand {
  firstName: string;
  lastName: string;
  pseudo: string;
  email: string;
  password: string;
}

/** Commande d'auto-édition du profil. Le rôle en est volontairement absent. */
export interface UpdateProfileCommand {
  firstName: string;
  lastName: string;
  pseudo: string;
  email: string;
}

/**
 * Agrégat racine User.
 *
 * Porte toutes les règles du compte utilisateur : champs obligatoires, longueur
 * du mot de passe, normalisation de l'email, autorisations d'auto-administration.
 * Zéro dépendance NestJS/TypeORM — le hachage passe par le port `IPasswordHasher`.
 *
 * Seule règle qui reste hors de l'agrégat : l'unicité de l'email, qui exige de
 * connaître les AUTRES utilisateurs — donnée qu'un agrégat n'a structurellement
 * pas. Elle vit dans la contrainte `unique` PostgreSQL, traduite en
 * `ConflictException` par `UserRepository`.
 */
export class User {
  constructor(
    readonly id: number,
    private _firstName: string,
    private _lastName: string,
    private _pseudo: string,
    private _email: string,
    private _passwordHash: string,
    private readonly _role: UserRole,
    private _isActive: boolean,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  get firstName(): string { return this._firstName; }
  get lastName(): string { return this._lastName; }
  get pseudo(): string { return this._pseudo; }
  get email(): string { return this._email; }
  get role(): UserRole { return this._role; }
  get isActive(): boolean { return this._isActive; }

  /**
   * Le hash n'est jamais exposé par le mapper HTTP. Ce getter existe pour la
   * seule persistance (`UserMapper.toOrm`) — d'où le nom explicite, qui rend
   * une fuite accidentelle visible à la lecture du code appelant.
   */
  get passwordHash(): string { return this._passwordHash; }

  /**
   * Nom sous lequel cet utilisateur est désigné PARTOUT dans l'application :
   * navbar, liste des participants d'une campagne, journal de partie, fiche
   * d'équipe exportable, organisateur d'une campagne.
   *
   * Unique point de vérité de la règle "quel nom afficher" — aucun appelant ne
   * lit `pseudo` directement pour de l'affichage. Faire évoluer la règle (repli
   * sur prénom/nom, format "Pseudo (Prénom)"…) ne demande de toucher que ce
   * getter. Le champ `pseudo` brut reste exposé séparément par le DTO HTTP, pour
   * le seul pré-remplissage du formulaire d'édition — même couple que
   * `Vehicle.customName` (brut) / `Vehicle.nom` (résolu).
   */
  get callName(): string {
    return this._pseudo;
  }

  // ── Fabriques ─────────────────────────────────────────────────────────────

  /**
   * Inscription d'un nouveau compte. `id`/`createdAt`/`updatedAt` sont assignés
   * par la base à la persistance — d'où les valeurs neutres ici.
   *
   * Le rôle est toujours USER : un compte admin ne peut pas naître d'une
   * inscription, quelle que soit la charge utile reçue (le champ n'existe même
   * pas dans `RegisterDto`).
   */
  static register(cmd: RegisterUserCommand, hasher: IPasswordHasher): Promise<User> {
    return User.create(cmd, hasher, UserRole.USER);
  }

  /**
   * Compte administrateur unique, créé au démarrage depuis `.env`. Distinct de
   * `register()` sur le seul rôle — l'agrégat reste ainsi le seul endroit qui
   * sait fabriquer un `User`, y compris un admin.
   */
  static registerAdmin(cmd: RegisterUserCommand, hasher: IPasswordHasher): Promise<User> {
    return User.create(cmd, hasher, UserRole.ADMIN);
  }

  private static async create(
    cmd: RegisterUserCommand,
    hasher: IPasswordHasher,
    role: UserRole,
  ): Promise<User> {
    User.assertRequiredIdentity(cmd);
    User.assertPasswordPolicy(cmd.password);

    return new User(
      0,
      cmd.firstName.trim(),
      cmd.lastName.trim(),
      cmd.pseudo.trim(),
      User.normalizeEmail(cmd.email),
      await hasher.hash(cmd.password),
      role,
      true,
      new Date(),
      new Date(),
    );
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  /**
   * Auto-édition du profil. Ne touche jamais `_role` (déclaré `readonly`) :
   * l'impossibilité pour un utilisateur de changer son propre rôle est
   * structurelle, pas une vérification qu'un appelant pourrait oublier.
   */
  updateProfile(cmd: UpdateProfileCommand): void {
    User.assertRequiredIdentity(cmd);

    this._firstName = cmd.firstName.trim();
    this._lastName = cmd.lastName.trim();
    this._pseudo = cmd.pseudo.trim();
    this._email = User.normalizeEmail(cmd.email);
  }

  /**
   * Changement de mot de passe par l'utilisateur lui-même : exige le mot de
   * passe actuel, même principe que la connexion.
   */
  async changePassword(
    currentPassword: string,
    newPassword: string,
    hasher: IPasswordHasher,
  ): Promise<void> {
    if (!currentPassword || !newPassword) {
      throw new DomainException('Tous les champs sont obligatoires');
    }
    if (!(await hasher.compare(currentPassword, this._passwordHash))) {
      throw new DomainException('Mot de passe actuel incorrect');
    }
    User.assertPasswordPolicy(newPassword);

    this._passwordHash = await hasher.hash(newPassword);
  }

  /**
   * Réinitialisation du mot de passe sans connaître l'ancien — point d'entrée
   * sans garde, utilisé par la resynchronisation du compte admin depuis
   * `.env` au démarrage ET par `resetPasswordAsAdmin` ci-dessous.
   */
  async resetPassword(newPassword: string, hasher: IPasswordHasher): Promise<void> {
    User.assertPasswordPolicy(newPassword);
    this._passwordHash = await hasher.hash(newPassword);
  }

  /**
   * Réinitialisation par un administrateur, sans connaître l'ancien mot de
   * passe. Même garde que `setActive`/`assertRemovableBy` : un admin ne peut
   * pas se cibler lui-même par cette action (il dispose déjà de son propre
   * "Changer le mot de passe", qui vérifie le mot de passe actuel).
   */
  async resetPasswordAsAdmin(newPassword: string, requesterId: number, hasher: IPasswordHasher): Promise<void> {
    if (this.id === requesterId) {
      throw new DomainException(
        'Vous ne pouvez pas réinitialiser le mot de passe de votre propre compte par cette action',
      );
    }
    await this.resetPassword(newPassword, hasher);
  }

  /** Idem : resynchronisation de l'email admin depuis `.env`, hors auto-édition. */
  changeEmail(email: string): void {
    const normalized = User.normalizeEmail(email);
    if (!normalized) {
      throw new DomainException('Tous les champs sont obligatoires');
    }
    this._email = normalized;
  }

  /**
   * Activation/désactivation par un administrateur. Un admin ne peut pas se
   * désactiver lui-même : il se verrouillerait hors de l'application jusqu'au
   * prochain redémarrage du backend.
   */
  setActive(isActive: boolean, requesterId: number): void {
    if (this.id === requesterId) {
      throw new DomainException('Vous ne pouvez pas modifier le statut de votre propre compte');
    }
    this._isActive = isActive;
  }

  // ── Règles de lecture ─────────────────────────────────────────────────────

  /**
   * Vérifie qu'une tentative de connexion aboutit. Le message d'erreur est
   * volontairement générique sur le mot de passe (pas d'énumération d'emails) ;
   * il est en revanche explicite sur un compte désactivé — à ce stade le mot de
   * passe a déjà été validé, la distinction ne révèle donc plus rien.
   */
  async assertCanAuthenticate(password: string, hasher: IPasswordHasher): Promise<void> {
    if (!(await hasher.compare(password, this._passwordHash))) {
      throw new DomainException('Identifiants invalides');
    }
    this.assertCanHoldSession();
  }

  /**
   * Un compte désactivé ne peut détenir aucune session, y compris une déjà
   * émise (JWT) : consultée par `JwtStrategy.validate()` à chaque requête
   * authentifiée, pas seulement à la connexion — sinon désactiver un compte
   * n'aurait d'effet qu'après expiration de son token (jusqu'à 7 jours).
   */
  assertCanHoldSession(): void {
    if (!this._isActive) {
      throw new DomainException('Ce compte a été désactivé');
    }
  }

  /**
   * Même garde-fou que `setActive` : un admin qui se supprime perd tout accès
   * jusqu'à ce que le seed recrée son compte au prochain démarrage.
   */
  assertRemovableBy(requesterId: number): void {
    if (this.id === requesterId) {
      throw new DomainException('Vous ne pouvez pas supprimer votre propre compte');
    }
  }

  /**
   * Usurpation d'identité par un administrateur ("se connecter en tant que").
   * Réservée aux comptes `USER` - jamais un autre admin, y compris l'admin
   * lui-même (son propre compte est toujours `ADMIN`, donc déjà exclu par cette
   * garde sans vérification de `requesterId` dédiée). Délègue à
   * `assertCanHoldSession` pour échouer immédiatement sur un compte désactivé,
   * plutôt que d'émettre un token qui échouerait à la première requête suivante.
   */
  assertImpersonatableBy(): void {
    if (this._role !== UserRole.USER) {
      throw new DomainException('Impossible de se connecter en tant qu\'un autre administrateur');
    }
    this.assertCanHoldSession();
  }

  // ── Validations privées ───────────────────────────────────────────────────

  private static assertRequiredIdentity(cmd: UpdateProfileCommand): void {
    if (!cmd.firstName?.trim() || !cmd.lastName?.trim() || !cmd.pseudo?.trim() || !cmd.email?.trim()) {
      throw new DomainException('Tous les champs sont obligatoires');
    }
  }

  private static assertPasswordPolicy(password: string): void {
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      throw new DomainException(
        `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères`,
      );
    }
  }

  private static normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }
}
