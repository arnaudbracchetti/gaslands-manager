export class RecordResultItemDto {
  participantId!: number;
  rank!: number;
}

export class RecordResultDto {
  results!: RecordResultItemDto[];
}
