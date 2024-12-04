/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { DefaultSession } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

import { createTable, db, schema } from "@ape-analytics/db";
import { discord } from "@ape-analytics/services";

import { env } from "../env";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
  }

  // interface User {
  //   // ...other properties
  //   // role: UserRole;
  // }
}
export type { Session } from "next-auth";
/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  callbacks: {
    signIn: async ({ user }) => {
      console.log(`user has logged in: '${user.name}'`);
      const discordClient = new discord.DiscordManager();
      // If you want to allow only users with a specific role to sign in, you can check the
      // `profile` object here. Example:
      // if (profile?.role !== "admin") {
      //   return false;
      // }
      let userDb = await db.query.users.findFirst({
        where: eq(schema.users.id, user.id ?? ""),
      });
      let userSubscription = await db.query.subscription.findFirst({
        where: eq(schema.subscription.userId, user.id ?? ""),
      });
      if (!userDb) {
        let casaGuild =
          await discordClient.getGuildFromDatabase("Ape Analytics");
        if (!casaGuild) {
          const queriedServer =
            await discordClient.getGuildWithName("Ape Analytics");
          if (!queriedServer) {
            console.log(`Could not find server with name "Ape Analytics"`);
            return false;
          }
          const returnedRows = await db
            .insert(schema.discordServer)
            .values({
              id: queriedServer.id,
              name: queriedServer.name,
              memberCount: queriedServer.memberCount,
            })
            .returning();
          casaGuild = returnedRows[0]!;
        }
        const members = await discordClient.getAllUsersInGuild(
          casaGuild.id as string,
        );
        const member = members.find(
          (member: { id: string | undefined }) => member.id === user.id,
        );
        if (!member || !user.id) {
          console.log(`User not found in guild`);
          return false;
        }
        const newUserResults = await db
          .insert(schema.users)
          .values({
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            joinedDiscordServerAt: member.joinedAt,
          })
          .returning();
        const newUser = newUserResults[0];
        if (!newUser) {
          return false;
        }
        userDb = newUser;
      }
      if (!userSubscription) {
        const newSubscriptionRows = await db
          .insert(schema.subscription)
          .values({
            userId: userDb.id,
            status: "ACTIVE",
            tier: "Researcher",
          })
          .returning();
        userSubscription = newSubscriptionRows[0];
        if (!userSubscription) {
          return false;
        }
        await db
          .insert(schema.subscriptionHistory)
          .values({
            subscriptionId: userSubscription.id,
            startDate: new Date(),
          })
          .returning();
      }

      return true;
    },
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
      },
    }),
  },
  debug: true,
  adapter: DrizzleAdapter(db, createTable),
  providers: [
    DiscordProvider({
      clientId: env.AUTH_DISCORD_ID,
      clientSecret: env.AUTH_DISCORD_SECRET,
      // allowDangerousEmailAccountLinking: true,
    }),
    /**
     * ...add more providers here.
     *
     * Most other providers require a bit more work than the Discord provider. For example, the
     * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
     * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
     *
     * @see https://next-auth.js.org/providers/github
     */
  ],
});

/**
 * Wrapper for `getServerSession` so that you don't need to import the `authOptions` in every file.
 *
 * @see https://next-auth.js.org/configuration/nextjs
 */
// export const getServerAuthSession = () => getServerSession(authOptions);
