/**
 * Tests de l'agrégat User — aucun mock NestJS, aucune base de données :
 * `new User(...)` + un double minimal d'`IPasswordHasher` suffisent. C'est le
 * retour sur investissement direct d'un domaine sans framework.
 */
import { DomainException } from '../../shared/domain/domain-exception';
import type { IPasswordHasher } from './password-hasher.interface';
import { User } from './user';
import { UserRole } from './user-role';

/**
 * Double de test du port de hachage : préfixe déterministe plutôt que bcrypt —
 * les tests n'ont pas à payer le coût 10 (~100 ms par appel) pour vérifier des
 * règles qui ne dépendent que du VERDICT de comparaison.
 */
const hasher: IPasswordHasher = {
  hash: async (plain) => `hashed:${plain}`,
  compare: async (plain, hash) => hash === `hashed:${plain}`,
};

const validRegistration = {
  firstName: 'Max',
  lastName: 'Rockatansky',
  pseudo: 'MadMax',
  email: 'Max@Test.COM',
  password: 'interceptor',
};

function buildUser(overrides: Partial<{ id: number; pseudo: string; isActive: boolean; role: UserRole }> = {}): User {
  return new User(
    overrides.id ?? 1,
    'Max',
    'Rockatansky',
    overrides.pseudo ?? 'MadMax',
    'max@test.com',
    'hashed:interceptor',
    overrides.role ?? UserRole.USER,
    overrides.isActive ?? true,
    new Date(),
    new Date(),
  );
}

describe('User (agrégat)', () => {
  describe('callName', () => {
    it('retourne le pseudo', () => {
      expect(buildUser({ pseudo: 'Furiosa' }).callName).toBe('Furiosa');
    });

    it('reflète le pseudo mis à jour par updateProfile', () => {
      const user = buildUser({ pseudo: 'MadMax' });

      user.updateProfile({ firstName: 'Max', lastName: 'R.', pseudo: 'RoadWarrior', email: 'max@test.com' });

      expect(user.callName).toBe('RoadWarrior');
    });
  });

  describe('register', () => {
    it('normalise l\'email, trim les champs et hache le mot de passe', async () => {
      const user = await User.register({ ...validRegistration, firstName: '  Max  ', pseudo: ' MadMax ' }, hasher);

      expect(user.email).toBe('max@test.com');
      expect(user.firstName).toBe('Max');
      expect(user.pseudo).toBe('MadMax');
      expect(user.passwordHash).toBe('hashed:interceptor');
    });

    it('crée toujours un compte actif de rôle USER', async () => {
      const user = await User.register(validRegistration, hasher);

      expect(user.role).toBe(UserRole.USER);
      expect(user.isActive).toBe(true);
    });

    it.each(['firstName', 'lastName', 'pseudo', 'email'] as const)(
      'refuse une inscription sans %s',
      async (champ) => {
        await expect(User.register({ ...validRegistration, [champ]: '   ' }, hasher)).rejects.toThrow(DomainException);
      },
    );

    it('refuse un mot de passe de moins de 6 caractères', async () => {
      await expect(User.register({ ...validRegistration, password: 'abc' }, hasher)).rejects.toThrow(
        'Le mot de passe doit faire au moins 6 caractères',
      );
    });
  });

  describe('registerAdmin', () => {
    it('crée un compte de rôle ADMIN', async () => {
      const admin = await User.registerAdmin(validRegistration, hasher);

      expect(admin.role).toBe(UserRole.ADMIN);
    });
  });

  describe('updateProfile', () => {
    it('met à jour identité et email normalisé', () => {
      const user = buildUser();

      user.updateProfile({ firstName: 'Furiosa', lastName: 'Jabassa', pseudo: 'Imperator', email: '  F@Test.COM ' });

      expect(user.firstName).toBe('Furiosa');
      expect(user.pseudo).toBe('Imperator');
      expect(user.email).toBe('f@test.com');
    });

    it('ne change jamais le rôle', () => {
      const user = buildUser({ role: UserRole.ADMIN });

      user.updateProfile({ firstName: 'Max', lastName: 'R.', pseudo: 'MadMax', email: 'max@test.com' });

      expect(user.role).toBe(UserRole.ADMIN);
    });

    it('refuse un pseudo vide', () => {
      const user = buildUser();

      expect(() =>
        user.updateProfile({ firstName: 'Max', lastName: 'R.', pseudo: '  ', email: 'max@test.com' }),
      ).toThrow(DomainException);
    });
  });

  describe('changePassword', () => {
    it('remplace le hash quand le mot de passe actuel est correct', async () => {
      const user = buildUser();

      await user.changePassword('interceptor', 'nouveaumdp', hasher);

      expect(user.passwordHash).toBe('hashed:nouveaumdp');
    });

    it('refuse un mot de passe actuel incorrect', async () => {
      const user = buildUser();

      await expect(user.changePassword('mauvais', 'nouveaumdp', hasher)).rejects.toThrow(
        'Mot de passe actuel incorrect',
      );
      expect(user.passwordHash).toBe('hashed:interceptor');
    });

    it('refuse un nouveau mot de passe trop court', async () => {
      const user = buildUser();

      await expect(user.changePassword('interceptor', 'abc', hasher)).rejects.toThrow(DomainException);
    });
  });

  describe('assertCanAuthenticate', () => {
    it('accepte un compte actif au bon mot de passe', async () => {
      await expect(buildUser().assertCanAuthenticate('interceptor', hasher)).resolves.toBeUndefined();
    });

    it('refuse un mot de passe invalide avec un message générique', async () => {
      await expect(buildUser().assertCanAuthenticate('mauvais', hasher)).rejects.toThrow('Identifiants invalides');
    });

    it('refuse un compte désactivé, même avec le bon mot de passe', async () => {
      await expect(buildUser({ isActive: false }).assertCanAuthenticate('interceptor', hasher)).rejects.toThrow(
        'Ce compte a été désactivé',
      );
    });
  });

  describe('assertCanHoldSession', () => {
    it('n\'a aucun effet sur un compte actif', () => {
      expect(() => buildUser({ isActive: true }).assertCanHoldSession()).not.toThrow();
    });

    it('refuse un compte désactivé', () => {
      expect(() => buildUser({ isActive: false }).assertCanHoldSession()).toThrow(DomainException);
      expect(() => buildUser({ isActive: false }).assertCanHoldSession()).toThrow('Ce compte a été désactivé');
    });
  });

  describe('auto-administration', () => {
    it('refuse qu\'un utilisateur se supprime lui-même', () => {
      expect(() => buildUser({ id: 7 }).assertRemovableBy(7)).toThrow(DomainException);
    });

    it('autorise la suppression d\'un autre compte', () => {
      expect(() => buildUser({ id: 7 }).assertRemovableBy(42)).not.toThrow();
    });

    it('refuse qu\'un utilisateur change son propre statut', () => {
      expect(() => buildUser({ id: 7 }).setActive(false, 7)).toThrow(DomainException);
    });

    it('désactive un autre compte', () => {
      const user = buildUser({ id: 7 });

      user.setActive(false, 42);

      expect(user.isActive).toBe(false);
    });

    it('refuse qu\'un admin réinitialise le mot de passe de son propre compte', async () => {
      await expect(buildUser({ id: 7 }).resetPasswordAsAdmin('nouveaumdp', 7, hasher)).rejects.toThrow(
        DomainException,
      );
    });

    it('réinitialise le mot de passe d\'un autre compte', async () => {
      const user = buildUser({ id: 7 });

      await user.resetPasswordAsAdmin('nouveaumdp', 42, hasher);

      expect(user.passwordHash).toBe('hashed:nouveaumdp');
    });

    it('applique la policy de longueur minimale lors d\'une réinitialisation admin', async () => {
      await expect(buildUser({ id: 7 }).resetPasswordAsAdmin('abc', 42, hasher)).rejects.toThrow(DomainException);
    });
  });

  describe('assertImpersonatableBy', () => {
    it('autorise l\'usurpation d\'un compte USER actif', () => {
      expect(() => buildUser({ role: UserRole.USER, isActive: true }).assertImpersonatableBy()).not.toThrow();
    });

    it('refuse l\'usurpation d\'un autre compte ADMIN', () => {
      expect(() => buildUser({ role: UserRole.ADMIN }).assertImpersonatableBy()).toThrow(
        'Impossible de se connecter en tant qu\'un autre administrateur',
      );
    });

    it('refuse l\'usurpation d\'un compte USER désactivé', () => {
      expect(() => buildUser({ role: UserRole.USER, isActive: false }).assertImpersonatableBy()).toThrow(
        'Ce compte a été désactivé',
      );
    });
  });
});
