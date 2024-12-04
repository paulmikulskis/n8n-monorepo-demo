import type { AdapterAccount } from "next-auth/adapters";
import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTableCreator,
  primaryKey,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => `app_${name}`);

export const posts = createTable(
  "post",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 256 }),
    createdById: varchar("createdById", { length: 255 })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updatedAt"),
  },
  (example) => ({
    createdByIdIdx: index("createdById_idx").on(example.createdById),
    nameIndex: index("name_idx").on(example.name),
  }),
);

export const users = createTable("user", {
  id: varchar("id", { length: 255 }).notNull().primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  emailVerified: timestamp("emailVerified", {
    mode: "date",
  }).default(sql`CURRENT_TIMESTAMP`),
  image: varchar("image", { length: 255 }),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  discordRoleId: varchar("discordRoleId", { length: 255 }), // Adjusted for Discord role ID
  inviteId: integer("inviteId"), // For linking to the invite model
  createdAt: timestamp("createdAt")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updatedAt")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  joinedDiscordServerAt: timestamp("joinedDiscordServerAt", { mode: "date" }),
});

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
}));

export const accounts = createTable(
  "account",
  {
    userId: varchar("userId", { length: 255 })
      .notNull()
      .references(() => users.id),
    type: varchar("type", { length: 255 })
      .$type<AdapterAccount["type"]>()
      .notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("providerAccountId", { length: 255 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
    userIdIdx: index("account_userId_idx").on(account.userId),
  }),
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
  "session",
  {
    sessionToken: varchar("sessionToken", { length: 255 })
      .notNull()
      .primaryKey(),
    userId: varchar("userId", { length: 255 })
      .notNull()
      .references(() => users.id),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (session) => ({
    userIdIdx: index("session_userId_idx").on(session.userId),
  }),
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  "verificationToken",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);

export const subscription = createTable(
  "subscription",
  {
    id: serial("id").primaryKey(),
    userId: varchar("userId", { length: 255 })
      .notNull()
      .references(() => users.id),
    status: varchar("status", { length: 20 }).notNull(), // active, cancelled
    tier: varchar("tier", { length: 10 }).notNull(), // researcher, extra, pro
    stripeSubscriptionId: varchar("stripeSubscriptionId", {
      length: 255,
    }),
    stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", {
      length: 255,
    }),
    createdAt: timestamp("createdAt")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updatedAt"),
  },
  (sub) => ({
    userIdIdx: index("subscription_userId_idx").on(sub.userId),
  }),
);

export const subscriptionHistory = createTable("subscriptionHistory", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscriptionId")
    .notNull()
    .references(() => subscription.id),
  startDate: timestamp("startDate").notNull(), // Tracks when the subscription period starts
  endDate: timestamp("endDate"), // Tracks when the subscription period ends, if applicable
  tier: varchar("tier", { length: 10 }).default("Researcher").notNull(), // researcher, extra, pro
  paymentStatus: varchar("payment", { length: 255 }).default("UNPAID"), // Tracks the payment method used
  createdAt: timestamp("createdAt")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const invite = createTable(
  "invite",
  {
    id: serial("id").primaryKey(),
    userId: varchar("userId", { length: 255 })
      .notNull()
      .references(() => users.id),
    code: varchar("code", { length: 255 }).notNull().unique(),
    uses: integer("uses").default(0).notNull(),
    createdAt: timestamp("createdAt")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (inv) => ({
    userIdIdx: index("invite_userId_idx").on(inv.userId),
  }),
);

export const subscriptionRelations = relations(
  subscription,
  ({ one, many }) => ({
    user: one(users, { fields: [subscription.userId], references: [users.id] }),
    history: many(subscriptionHistory),
  }),
);

export const subscriptionHistoryRelations = relations(
  subscriptionHistory,
  ({ one }) => ({
    subscription: one(subscription, {
      fields: [subscriptionHistory.subscriptionId],
      references: [subscription.id],
    }),
  }),
);

export const inviteRelations = relations(invite, ({ one }) => ({
  user: one(users, { fields: [invite.userId], references: [users.id] }),
}));

export const discordServer = createTable("discordServer", {
  id: varchar("id", { length: 255 }).notNull().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  icon: varchar("icon", { length: 255 }),
  memberCount: integer("memberCount").notNull(),
});
