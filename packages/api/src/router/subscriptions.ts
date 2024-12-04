/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@ape-analytics/db";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export function getHostname() {
  if (!(process.env.NODE_ENV === "development")) {
    return process.env.NEXTAUTH_URL;
  } else {
    return "http://localhost:3000";
  }
}

export const subscriptionRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),

  getUserStripeSubscription: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const userSubscription = await ctx.db.query.subscription.findFirst({
      where: eq(schema.subscription.userId, userId),
    });
    if (!userSubscription?.stripeSubscriptionId) {
      return { error: "No active subscription found for the user" };
    }
    const stripeSubscription = await ctx.stripe.subscriptions.retrieve(
      userSubscription.stripeSubscriptionId,
    );
    if (!stripeSubscription) {
      return { error: "Stripe subscription not found" };
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return stripeSubscription;
  }),

  createStripeCheckoutSession: protectedProcedure
    .input(z.object({ tier: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { tier } = input;
      const userId = ctx.session.user.id;

      const lineItems = [
        {
          price:
            tier === "Extra"
              ? process.env.EXTRA_SUBSCRIPTION_ID_MONTHLY
              : process.env.PRO_SUBSCRIPTION_ID_MONTHLY,
          quantity: 1,
        },
      ];

      const session = await ctx.stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "subscription",
        success_url: `${getHostname()}/membership/success`,
        cancel_url: `${getHostname()}/membership/cancel`,
        client_reference_id: userId,
      });

      await db
        .update(schema.subscription)
        .set({ tier, stripeCheckoutSessionId: session.id })
        .where(eq(schema.subscription.userId, userId));

      return { sessionId: session.id, sessionUrl: session.url, tier };
    }),

  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Find the user's active subscription in the database
    const userSubscription = await ctx.db.query.subscription.findFirst({
      where: eq(schema.subscription.userId, userId),
    });

    if (!userSubscription) {
      throw new Error("No active subscription found for the user");
    }

    if (!userSubscription.stripeSubscriptionId) {
      throw new Error("Stripe subscription ID not found for the user");
    }

    try {
      // Cancel the subscription in Stripe
      const deletedSubscription = await ctx.stripe.subscriptions.cancel(
        userSubscription.stripeSubscriptionId,
      );

      if (deletedSubscription.status === "canceled") {
        // Update the subscription status in the database
        await db
          .update(schema.subscription)
          .set({ status: "CANCELED", updatedAt: new Date() })
          .where(eq(schema.subscription.userId, userId));

        // Update the subscription history
        // find the most recent subscription history
        const recentSubscriptionHistory =
          await db.query.subscriptionHistory.findFirst({
            where: eq(
              schema.subscriptionHistory.subscriptionId,
              userSubscription.id,
            ),
            orderBy: desc(schema.subscriptionHistory.startDate),
          });
        if (!recentSubscriptionHistory) {
          throw new Error(
            "No subscription history found for the user, nothing to cancel",
          );
        }
        await db
          .update(schema.subscriptionHistory)
          .set({ endDate: new Date() })
          .where(
            eq(schema.subscriptionHistory.id, recentSubscriptionHistory.id),
          );

        // Remove the user's role in the Discord server
        const discordServer =
          await ctx.discord.getGuildFromDatabase("Ape Analytics");
        const guildId = discordServer?.id ?? "1217866693125341305";
        const role = await ctx.discord.getRoleByName(
          guildId,
          userSubscription.tier,
        );
        if (role) {
          await ctx.discord.removeRoleFromUser(guildId, userId, role.id);
        }
        // now, assign the 'Researcher' role to the user
        const researcherRole = await ctx.discord.getRoleByName(
          guildId,
          "Researcher",
        );
        if (researcherRole) {
          await ctx.discord.assignRoleToUser(
            guildId,
            userId,
            researcherRole.id,
          );
        }
        const newSubscriptionRows = await ctx.db
          .update(schema.subscription)
          .set({
            tier: "Researcher",
            stripeCheckoutSessionId: null,
            stripeSubscriptionId: null,
          })
          .where(eq(schema.subscription.userId, userId))
          .returning();
        const newSubscription = newSubscriptionRows[0];
        if (!newSubscription) {
          throw new Error("Failed to update subscription tier");
        }
        await ctx.db
          .update(schema.subscriptionHistory)
          .set({ endDate: new Date() })
          .where(
            eq(schema.subscriptionHistory.subscriptionId, newSubscription.id),
          )
          .returning();
        await ctx.db
          .insert(schema.subscriptionHistory)
          .values({
            subscriptionId: newSubscription.id,
            startDate: new Date(),
            paymentStatus: "UNPAID",
            tier: "Researcher",
          })
          .execute();

        return { success: true, message: "Subscription canceled successfully" };
      } else {
        throw new Error("Failed to cancel the subscription in Stripe");
      }
    } catch (error) {
      console.error("Error canceling subscription:", error);
      throw new Error("An error occurred while canceling the subscription");
    }
  }),

  completeStripeCheckoutSession: protectedProcedure.mutation(
    async ({ ctx }) => {
      const userId = ctx.session.user.id;
      const userCheckoutSessionId = await ctx.db.query.subscription.findFirst({
        where: eq(schema.subscription.userId, userId),
      });
      if (!userCheckoutSessionId?.stripeCheckoutSessionId) {
        return {
          error: `User ${userId} has no active Stripe checkout session`,
        };
      }

      const session = await ctx.stripe.checkout.sessions.retrieve(
        userCheckoutSessionId.stripeCheckoutSessionId,
      );

      if (session.status === "complete") {
        const subscriptionDbRows = await db
          .update(schema.subscription)
          .set({
            status: "ACTIVE",
            updatedAt: new Date(),
            stripeSubscriptionId: session.subscription?.toString(),
          })
          .where(eq(schema.subscription.userId, userId))
          .returning();
        const subscriptionDb = subscriptionDbRows[0];
        if (!subscriptionDb) {
          throw new Error(
            "Subscription not found when completing Stripe checkout session",
          );
        }

        const recentSubscriptionHistory =
          await db.query.subscriptionHistory.findFirst({
            where: eq(
              schema.subscriptionHistory.subscriptionId,
              subscriptionDb.id,
            ),
            orderBy: desc(schema.subscriptionHistory.startDate),
          });
        if (!recentSubscriptionHistory) {
          throw new Error(
            "No subscription history found for the user, nothing to cancel",
          );
        }
        await db
          .update(schema.subscriptionHistory)
          .set({ endDate: new Date() })
          .where(
            eq(schema.subscriptionHistory.id, recentSubscriptionHistory.id),
          );
        await db
          .update(schema.subscriptionHistory)
          .set({ endDate: new Date() })
          .where(
            eq(schema.subscriptionHistory.id, recentSubscriptionHistory.id),
          );

        const newSubscriptionHistoryRows = await db
          .insert(schema.subscriptionHistory)
          .values({
            subscriptionId: subscriptionDb.id,
            startDate: new Date(),
            paymentStatus: "PAID",
            tier: subscriptionDb.tier,
          })
          .returning()
          .execute();
        if (!newSubscriptionHistoryRows[0]) {
          throw new Error("Failed to create subscription history");
        }
        await db
          .update(schema.subscriptionHistory)
          .set({ paymentStatus: "PAID" })
          .where(
            eq(schema.subscriptionHistory.id, newSubscriptionHistoryRows[0].id),
          );

        const discordServer =
          await ctx.discord.getGuildFromDatabase("Ape Analytics");
        const subscriptionToHandle = await ctx.db.query.subscription.findFirst({
          where: eq(schema.subscription.userId, userId),
        });
        if (!subscriptionToHandle) {
          return { error: "Subscription not found in app database" };
        }
        const role = await ctx.discord.getRoleByName(
          discordServer?.id,
          subscriptionToHandle.tier,
        );
        if (!role) {
          return {
            error: `Role '${subscriptionToHandle.tier}' not found in discord server`,
          };
        }
        const guildId = discordServer?.id
        const updatedRole = await ctx.discord.assignRoleToUser(
          guildId,
          userId,
          role.id,
        );
        if (!updatedRole) {
          return {
            error: `unable to apply role '${subscriptionToHandle.tier}' to user ${userId} in discord server`,
          };
        }
        return { status: session.payment_status };
      }

      return { status: session.payment_status };
    },
  ),

  getInviteInfo: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    return await ctx.db.query.invite.findFirst({
      where: eq(schema.invite.userId, userId),
    });
  }),

  getUserSubscription: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.subscription.findFirst({
      where: eq(schema.subscription.userId, ctx.session.user.id),
    });
  }),

  getSubscriptionHistory: protectedProcedure.query(async ({ ctx }) => {
    const userSubscription = await ctx.db.query.subscription.findFirst({
      where: eq(schema.subscription.userId, ctx.session.user.id),
    });
    if (!userSubscription) {
      return [];
    }
    const history = await ctx.db.query.subscriptionHistory.findMany({
      where: eq(schema.subscriptionHistory.subscriptionId, userSubscription.id),
    });
    console.log(`history: ${history.length}`);
    return history;
  }),
});
