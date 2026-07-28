import type { UserResponseDto } from './user-response.dto';

/** Réponse de `POST /api/auth/register` et `POST /api/auth/login`. */
export interface AuthResponseDto {
  access_token: string;
  user: UserResponseDto;
}
