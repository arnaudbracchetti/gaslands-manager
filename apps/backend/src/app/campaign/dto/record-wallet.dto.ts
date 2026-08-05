import { IsEnum, IsInt, Min } from 'class-validator';
import { WalletReason } from '../domain/enums/wallet-reason.enum';

export class RecordWalletDto {
  @IsInt()
  @Min(1)
  participantId!: number;

  /** Positif = gain, négatif = dépense — pas de borne, un mouvement de cagnotte peut être négatif. */
  @IsInt()
  amount!: number;

  @IsEnum(WalletReason)
  reason!: WalletReason;
}
