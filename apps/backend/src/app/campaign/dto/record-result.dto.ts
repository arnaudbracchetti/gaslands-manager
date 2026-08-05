import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, Min, ValidateNested } from 'class-validator';

// Borne anti-DoS commune aux tableaux de ce DTO — jamais une règle métier
// (le nombre réel de participants/véhicules d'une campagne reste très inférieur).
const MAX_ITEMS = 50;

/**
 * `weightClass` n'est PAS transmis — dérivé côté serveur depuis le véhicule réel.
 *
 * Pas de `@Min(1)` sur `vehicleId` : un véhicule acheté en atelier (session courante
 * ou antérieure) est une entité transiente D-S11 dont l'id est `-event.id` (négatif),
 * jamais réinséré en base — `Team.findVehicle` ne distingue jamais selon le signe.
 */
export class DestroyedVehicleDto {
  @IsInt()
  vehicleId!: number;
}

export class RecordResultItemDto {
  @IsInt()
  @Min(1)
  participantId!: number;

  @IsInt()
  @Min(1)
  rank!: number;

  /** Portes franchies (exploit, US-B2) — optionnel, 0/absent si aucune. */
  @IsOptional()
  @IsInt()
  @Min(0)
  gatesCrossed?: number;

  /** Véhicules ennemis détruits (exploit, US-B2) — optionnel. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => DestroyedVehicleDto)
  destroyedVehicles?: DestroyedVehicleDto[];
}

/** Butin manuel de jerricans (scénario `gain_jerricans`) — Escarmouche uniquement. */
export class JerricanGainDto {
  @IsInt()
  @Min(1)
  participantId!: number;

  @IsInt()
  @Min(0)
  amount!: number;
}

/**
 * Véhicule ennemi détruit hors classement (Escarmouche) — trace journal uniquement,
 * 0 Point de Championnat (contrairement à `DestroyedVehicleDto`, imbriqué sous
 * `RecordResultItemDto.destroyedVehicles` pour un Événement Télévisé).
 */
export class EscarmoucheDestroyedVehicleDto {
  @IsInt()
  @Min(1)
  destroyerId!: number;

  // Pas de `@Min(1)` — même raison que `DestroyedVehicleDto.vehicleId` ci-dessus
  // (entité transiente D-S11 possible, id négatif).
  @IsInt()
  vehicleId!: number;
}

/**
 * Points de sabotage dépensés (déclaration rétroactive de l'organisateur, écran dédié du
 * wizard) — applicable aux deux types de partie, contrairement à `results`/
 * `jerricanGains` ci-dessous. `pointsSpent` est la valeur DÉCLARÉE, pas encore clampée :
 * le clamp au solde réellement disponible est fait côté serveur
 * (`SabotagePointsSpentEvent.declare`), jamais côté client (le solde n'est jamais
 * affiché à l'écran).
 */
export class SabotageSpentDto {
  @IsInt()
  @Min(1)
  participantId!: number;

  @IsInt()
  @Min(0)
  pointsSpent!: number;
}

/**
 * Corps de `POST .../results`. `results` (classement + exploits) n'est envoyé que pour
 * un Événement Télévisé ; `jerricanGains`/`destroyedVehicles` (à plat) uniquement pour
 * une Escarmouche. `sabotageSpent` est indépendant du type de partie.
 *
 * Chaque tableau porte `@ValidateNested({ each: true }) @Type(() => ...)` : sans le
 * `@Type()` (class-transformer), `plainToInstance` ne convertit pas les objets JSON
 * bruts en instances des sous-classes ci-dessus, et `@ValidateNested` ne validerait
 * alors silencieusement rien.
 */
export class RecordResultDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => RecordResultItemDto)
  results?: RecordResultItemDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => JerricanGainDto)
  jerricanGains?: JerricanGainDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => EscarmoucheDestroyedVehicleDto)
  destroyedVehicles?: EscarmoucheDestroyedVehicleDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => SabotageSpentDto)
  sabotageSpent?: SabotageSpentDto[];
}
