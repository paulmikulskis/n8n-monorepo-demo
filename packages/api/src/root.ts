import { discordRouter } from "./router/discord";
import { subscriptionRouter } from "./router/subscriptions";
import { userRouter } from "./router/users";
import { createTRPCRouter } from "./trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  subscription: subscriptionRouter,
  users: userRouter,
  discord: discordRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
