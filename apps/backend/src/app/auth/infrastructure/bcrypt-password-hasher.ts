import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { IPasswordHasher } from '../domain/password-hasher.interface';

/**
 * Adaptateur du port `IPasswordHasher` vers bcrypt — pendant exact de
 * `RandomProvider` pour `IRandomizer` (cf. ARCHITECTURE.md §3.8).
 *
 * Seul endroit du code qui importe bcrypt : le coût de hachage y est décidé
 * une fois pour toutes, plutôt que répété à chaque appelant.
 */
@Injectable()
export class BcryptPasswordHasher implements IPasswordHasher {
  /** Coût 10 ≈ 100 ms par hachage — standard, protège du brute-force. */
  private static readonly SALT_ROUNDS: number = 10;

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, BcryptPasswordHasher.SALT_ROUNDS);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
