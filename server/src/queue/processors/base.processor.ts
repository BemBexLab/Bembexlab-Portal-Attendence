import type { Job } from 'bullmq';

export abstract class BaseJobProcessor<Data = unknown, Result = unknown> {
  abstract process(job: Job<Data>): Promise<Result>;
}
