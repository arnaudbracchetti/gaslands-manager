/**
 * AuthService — logique métier de l'authentification.
 *
 * Ce service orchestre :
 * 1. L'inscription : création de l'utilisateur + émission d'un JWT
 * 2. La connexion : vérification du mot de passe + émission d'un JWT
 *
 * Le JWT (JSON Web Token) est un token signé qui contient des informations
 * sur l'utilisateur. Il est envoyé au client qui le stocke (localStorage)
 * et le renvoie dans chaque requête via le header Authorization: Bearer <token>.
 * Le serveur vérifie la signature sans requête base de données (c'est l'avantage).
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserRole } from './user.entity';
import { SafeUser, UserService } from './user.service';

// Forme de la réponse renvoyée au client après login ou register
export interface AuthResponse {
  access_token: string;
  user: SafeUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    // JwtService (de @nestjs/jwt) permet de signer et vérifier les tokens
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Inscription d'un nouvel utilisateur.
   * UserService.create() gère le hachage et lève ConflictException si l'email existe.
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    // Validation basique des champs obligatoires
    if (!dto.firstName || !dto.lastName || !dto.email || !dto.password) {
      throw new UnauthorizedException('Tous les champs sont obligatoires');
    }
    if (dto.password.length < 6) {
      throw new UnauthorizedException('Le mot de passe doit faire au moins 6 caractères');
    }

    const user = await this.userService.create(dto);
    const access_token = this.signToken(user.id, user.email, user.role);

    return { access_token, user };
  }

  /**
   * Connexion d'un utilisateur existant.
   *
   * Sécurité : on retourne TOUJOURS le même message d'erreur ("Identifiants invalides")
   * que l'email soit inconnu ou que le mot de passe soit faux.
   * Cela évite l'énumération d'emails (un attaquant ne peut pas savoir
   * si un email est enregistré ou non).
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    // 1. Chercher l'utilisateur (avec son password hash)
    const user = await this.userService.findByEmail(dto.email);

    // 2. Si l'utilisateur n'existe pas → erreur générique (pas "email inconnu")
    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    // 3. Comparer le mot de passe fourni avec le hash bcrypt en base
    // bcrypt.compare() retourne true si les mots de passe correspondent
    const passwordValid = await bcrypt.compare(dto.password, user.password);

    if (!passwordValid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    // 4. Compte désactivé par un admin (UsersController) : on bloque ici,
    // après la vérification du mot de passe — un message distinct est
    // acceptable (le mot de passe a déjà été validé, pas de risque
    // d'énumération d'emails supplémentaire).
    if (!user.isActive) {
      throw new UnauthorizedException('Ce compte a été désactivé');
    }

    // 5. Tout est bon : signer le JWT et retourner user sans password
    const { password, ...safeUser } = user;
    const access_token = this.signToken(user.id, user.email, user.role);

    return { access_token, user: safeUser };
  }

  /**
   * Crée et signe un JWT contenant l'id, l'email et le rôle de l'utilisateur.
   *
   * Le payload est encodé (base64) mais PAS chiffré → ne pas y mettre
   * d'informations sensibles (mot de passe, données bancaires, etc.).
   * La sécurité repose sur la SIGNATURE qui garantit l'intégrité.
   *
   * `role` est inclus pour permettre à de futurs guards (ex: RolesGuard)
   * de vérifier les droits sans requête base de données supplémentaire.
   */
  private signToken(userId: number, email: string, role: UserRole): string {
    return this.jwtService.sign({
      sub: userId,  // "sub" = subject, convention JWT RFC 7519
      email,
      role,
    });
  }
}
