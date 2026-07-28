import type { UserRole } from '../domain/user-role';

/**
 * Forme d'un utilisateur dans TOUTE réponse HTTP — remplace l'ancien
 * `SafeUser = Omit<UserOrm, 'password'>`.
 *
 * Le hash n'y figure pas par CONSTRUCTION (champ privé de l'agrégat, jamais
 * recopié par le mapper), et non plus par omission via déstructuration — une
 * omission se perd au premier `...spread` distrait.
 *
 * `pseudo` et `callName` coexistent volontairement :
 * - `pseudo` = valeur brute, seul usage = pré-remplir le champ éditable du
 *   formulaire "Détails du compte" ;
 * - `callName` = valeur calculée par le getter du domaine, à utiliser pour
 *   TOUT affichage.
 * Même couple que `Vehicle.customName` (brut) / `Vehicle.nom` (résolu) côté
 * véhicules, cf. spec/VEHICLES.md.
 */
export interface UserResponseDto {
  id: number;
  firstName: string;
  lastName: string;
  pseudo: string;
  callName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
