import { WalletReason } from '../domain/enums/wallet-reason.enum';

export class RecordWalletDto {
  participantId!: number;
  /** Positif = gain, négatif = dépense. */
  amount!: number;
  reason!: WalletReason;
}
