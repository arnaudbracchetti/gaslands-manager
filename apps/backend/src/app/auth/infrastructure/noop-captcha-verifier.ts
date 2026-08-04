import { Injectable } from '@nestjs/common';
import type { ICaptchaVerifier } from '../domain/captcha-verifier.interface';

/**
 * Adaptateur neutre du port `ICaptchaVerifier` - résout toujours,
 * sélectionné uniquement quand `TURNSTILE_SECRET_KEY` est absent
 * (dev/e2e). Voir `auth.module.ts` pour le choix d'adaptateur.
 */
@Injectable()
export class NoopCaptchaVerifier implements ICaptchaVerifier {
  async assertHuman(): Promise<void> {
    // Toujours humain : neutralise le contrôle en dev/e2e.
  }
}
