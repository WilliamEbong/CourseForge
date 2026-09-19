/**
 * One learner result as sent by a tracked course (and by `configure`'s connection test) to a Google Sheet or the
 * self-hosted tracker. The browser runtime builds the same shape by hand (no zod in the course bundle); a unit
 * test keeps the two in step.
 */
import { z } from 'zod';

export const TrackingEventSchema = z.strictObject({
  v: z.literal(1),
  courseId: z.string().min(1).max(80),
  courseTitle: z.string().max(200),
  courseVersion: z.string().max(40),
  learner: z.strictObject({
    name: z.string().trim().min(1).max(120),
    id: z.string().trim().max(80).nullable(),
    email: z.string().trim().max(200).nullable(),
  }),
  /** Assessment score; null when the course has no graded questions (completion only). */
  percent: z.number().int().min(0).max(100).nullable(),
  passed: z.boolean().nullable(),
  correct: z.number().int().min(0).max(10000),
  total: z.number().int().min(0).max(10000),
  completedAt: z.string().min(10).max(40),
  /** 1 for the first recorded result from this browser, 2 for a retake, and so on. */
  attempt: z.number().int().min(1).max(10000),
  /** True only for the connection test sent during setup. */
  test: z.boolean(),
});
export type TrackingEvent = z.infer<typeof TrackingEventSchema>;
