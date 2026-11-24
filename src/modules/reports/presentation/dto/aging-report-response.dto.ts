export class AgingBucketDto {
  label!: string;
  /** Remaining balance as a decimal string. */
  amount!: string;
  count!: number;
}

export class AgingReportResponseDto {
  notDue!: AgingBucketDto;
  day1To7!: AgingBucketDto;
  day8To30!: AgingBucketDto;
  day31To60!: AgingBucketDto;
  day60Plus!: AgingBucketDto;
}
