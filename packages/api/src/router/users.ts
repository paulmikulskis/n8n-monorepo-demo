import { eq } from "drizzle-orm";

import { schema } from "@ape-analytics/db";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const userRouter = createTRPCRouter({
  getUser: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.users.findFirst({
      where: eq(schema.users.id, ctx.session.user.id),
    });
  }),
});
