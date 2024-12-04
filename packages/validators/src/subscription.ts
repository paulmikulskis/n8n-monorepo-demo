import type { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { schema } from "@ape-analytics/db";

export const createSubscriptionSchema = createInsertSchema(schema.subscription);
export const createSubscriptionHistorySchema = createInsertSchema(
  schema.subscriptionHistory,
);
export const selectSubscriptionSchema = createSelectSchema(schema.subscription);
export const selectSubscriptionHistorySchema = createSelectSchema(
  schema.subscriptionHistory,
);

export const SubscriptionSchema = {
  createSubscriptionSchema,
  createSubscriptionHistorySchema,
  selectSubscriptionSchema,
  selectSubscriptionHistorySchema,
};

export interface Subscriptions {
  Base: z.infer<typeof selectSubscriptionSchema>;
  History: z.infer<typeof selectSubscriptionHistorySchema>;
  Create: z.infer<typeof createSubscriptionSchema>;
  CreateHistory: z.infer<typeof createSubscriptionHistorySchema>;
}
