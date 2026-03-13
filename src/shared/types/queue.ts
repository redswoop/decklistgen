export type JobStatus = "pending" | "running" | "completed" | "failed";

export type GenMode = "clean" | "fullart";

export interface QueueJob {
  id: string;
  cardId: string;
  cardName: string;
  cardImageBase: string;
  status: JobStatus;
  mode: GenMode;
  force: boolean;
  seed: number;
  prompt?: string;
  ruleName?: string;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  submittedBy: string;
}
