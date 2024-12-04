/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// src/server/api/routers/discord.ts

import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const discordRouter = createTRPCRouter({
  sendMessage: protectedProcedure
    .input(
      z.object({ channelName: z.string().optional(), message: z.string() }),
    )
    .mutation(async ({ input, ctx }) => {
      const discord = ctx.discord;
      await discord.sendMessageToChannel(
        input.message,
        input.channelName ?? "pro-room",
      );
    }),
});
