import { Injectable, Logger } from '@nestjs/common';
import { DomainException } from '../../shared/domain/domain-exception';
import type { ICaptchaVerifier } from '../domain/captcha-verifier.interface';

interface TurnstileSiteVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
}

/**
 * Adaptateur du port `ICaptchaVerifier` vers Cloudflare Turnstile - pendant
 * de `BcryptPasswordHasher` pour `IPasswordHasher` (cf. ARCHITECTURE.md §3.8).
 *
 * Le secret est reçu en `string` par le constructeur (passé par la factory
 * d'`auth.module.ts`, jamais par `ConfigService` injecté directement) : la
 * classe reste testable unitairement sans mock NestJS.
 *
 * **Échec fermé** : jeton absent, réponse `success: false`, timeout ou
 * erreur réseau lèvent tous `DomainException` - un attaquant ne doit jamais
 * pouvoir contourner le captcha en saturant l'accès à Cloudflare.
 */
@Injectable()
export class TurnstileVerifier implements ICaptchaVerifier {
  private static readonly VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
  private static readonly TIMEOUT_MS = 5000;

  private readonly logger: Logger = new Logger(TurnstileVerifier.name);

  constructor(private readonly secretKey: string) {}

  async assertHuman(token?: string, remoteIp?: string): Promise<void> {
    if (!token) {
      throw new DomainException('Vérification anti-robot échouée');
    }

    const body = new URLSearchParams({ secret: this.secretKey, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);

    let result: TurnstileSiteVerifyResponse;
    try {
      const res = await fetch(TurnstileVerifier.VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(TurnstileVerifier.TIMEOUT_MS),
      });
      result = (await res.json()) as TurnstileSiteVerifyResponse;
    } catch (err) {
      this.logger.warn(`Appel à Turnstile échoué : ${(err as Error).message}`);
      throw new DomainException('Vérification anti-robot échouée');
    }

    if (!result.success) {
      this.logger.warn(`Turnstile a rejeté le jeton : ${(result['error-codes'] ?? []).join(', ')}`);
      throw new DomainException('Vérification anti-robot échouée');
    }
  }
}
