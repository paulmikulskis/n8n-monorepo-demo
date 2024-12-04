/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { z } from "zod";
import { createSelectSchema } from "drizzle-zod";

import { schema } from "@ape-analytics/db";

export const selectDiscordServerSchema = createSelectSchema(
  schema.discordServer,
);
export type SelectDiscordServer = z.infer<typeof selectDiscordServerSchema>;
