type AgingBucket = { label: string; amount: string; count: number };

export type AgingReport = {
  notDue: AgingBucket;
  day1To7: AgingBucket;
  day8To30: AgingBucket;
  day31To60: AgingBucket;
  day60Plus: AgingBucket;
};
