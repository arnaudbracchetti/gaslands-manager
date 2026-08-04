/**
 * Source unique des entités ORM — consommée par `app.module.ts` (Nest) ET
 * par `data-source.ts` (CLI TypeORM, hors Nest). Les deux ne doivent jamais
 * lister les entités séparément : un oubli dans l'une des deux listes fait
 * diverger silencieusement le schéma vu par `synchronize`/Nest de celui vu
 * par les migrations générées en CLI.
 */
import { UserOrm } from './auth/infrastructure/entities/user.entity';
import { TeamOrm } from './team/infrastructure/entities/team.entity';
import {
  VehicleOrm,
  VehicleImprovementOrm,
  VehicleAdvantageOrm,
} from './team/infrastructure/entities/vehicle.entity';
import { WeaponOrm } from './team/infrastructure/entities/weapon.entity';
import { CampaignOrm } from './campaign/infrastructure/entities/campaign.entity';
import { CampaignParticipantOrm } from './campaign/infrastructure/entities/campaign-participant.entity';
import { GameOrm } from './campaign/infrastructure/entities/game.entity';
import { GameEventOrm } from './campaign/infrastructure/entities/game-event.entity';

export const ALL_ENTITIES = [
  TeamOrm,
  UserOrm,
  VehicleOrm,
  VehicleImprovementOrm,
  VehicleAdvantageOrm,
  WeaponOrm,
  CampaignOrm,
  CampaignParticipantOrm,
  GameOrm,
  GameEventOrm,
];
