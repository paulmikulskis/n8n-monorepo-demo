/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type {
  APIEmbed,
  EmbedData,
  Guild,
  GuildMember,
  Role,
  User,
} from "discord.js";
import { Client, EmbedBuilder, GatewayIntentBits } from "discord.js";
import { eq } from "drizzle-orm";

import type { discord as discordDomain } from "@ape-analytics/validators";
import { db, schema } from "@ape-analytics/db";

/* eslint-disable @typescript-eslint/no-unsafe-call */

export class DiscordManager {
  public client: Client;
  public isReady: boolean;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
    this.isReady = false;

    this.client.on("ready", () => {
      this.isReady = true;
      console.log("Discord client is ready!");
    });

    this.client.login(process.env.DISCORD_BOT_TOKEN).catch((err) => {
      console.error("Error logging in to Discord:", err);
    });
  }
  async waitForClientReady(): Promise<void> {
    if (!this.isReady) {
      await new Promise<void>((resolve) => {
        const checkReady = () => {
          if (this.isReady) {
            resolve();
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      });
    }
  }

  async getAllDiscordServers(): Promise<Guild[]> {
    await this.waitForClientReady();
    const allGuilds = this.client.guilds.cache;
    return [...allGuilds.values()];
  }

  async getGuildWithName(name: string): Promise<Guild | null> {
    await this.waitForClientReady();
    const guild = this.client.guilds.cache.find((g) => g.name === name);
    return guild ?? null;
  }

  async getGuildFromDatabase(
    guildName: string,
  ): Promise<discordDomain.SelectDiscordServer | null> {
    const guild = await db.query.discordServer.findFirst({
      where: eq(schema.discordServer.name, guildName),
    });
    return guild ?? null;
  }

  async getRoleByName(
    guildId: string,
    roleName: string,
  ): Promise<Role | undefined> {
    await this.waitForClientReady();
    const guild = await this.client.guilds.fetch(guildId);
    if (!guild) {
      throw new Error("Guild not found");
    }
    let role = guild.roles.cache.find((r) => r.name === roleName);
    if (role === null) {
      await guild.roles.fetch();
      role = guild.roles.cache.find((r) => r.name === roleName);
    }
    return role;
  }

  async getAllUsersInGuild(guildId: string): Promise<GuildMember[]> {
    await this.waitForClientReady();
    const guild = await this.client.guilds.fetch(guildId);
    if (!guild) {
      throw new Error("Guild not found");
    }
    const allUsers = await guild.members.fetch();
    return [...allUsers.values()];
  }

  async getUserById(userId: string): Promise<User | null> {
    await this.waitForClientReady();
    const user = await this.client.users.fetch(userId);
    return user ?? null;
  }

  async assignRoleToUser(
    guildId: string,
    userId: string,
    roleId: string,
  ): Promise<boolean> {
    await this.waitForClientReady();
    const guild = await this.client.guilds.fetch(guildId);
    if (!guild) {
      throw new Error("Guild not found");
    }
    const member = await guild.members.fetch(userId);
    if (!member) {
      throw new Error("User not found in the guild");
    }
    await member.roles.add(roleId);
    return true;
  }

  async removeRoleFromUser(
    guildId: string,
    userId: string,
    roleId: string,
  ): Promise<boolean> {
    await this.waitForClientReady();
    const guild = await this.client.guilds.fetch(guildId);
    if (!guild) {
      throw new Error("Guild not found");
    }
    const member = await guild.members.fetch(userId);
    if (!member) {
      throw new Error("User not found in the guild");
    }
    await member.roles.remove(roleId);
    return true;
  }

  async checkUserInDatabase(userId: string): Promise<boolean> {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });
    return user !== null;
  }

  printGuildUsers(guildUsers: GuildMember[]): void {
    guildUsers.forEach((user) => {
      console.log(`-------------\n${user.displayName}`);
      console.dir({
        id: user.id,
        displayName: user.displayName,
        roles: user.roles.cache
          .map((r) => r.name)
          .join(", ")
          .padStart(1),
      });
    });
  }

  async sendMessageToChannel(
    message: string,
    channelName: string,
    embedData: EmbedData | APIEmbed | null = null, // Optional parameter for embed data
    guildId = "1217866693125341305",
  ) {
    await this.waitForClientReady();
    const channelNameIsId = channelName.match(/^\d{17,19}$/);
    const guild = await this.client.guilds.fetch(guildId);
    const channelsInGuild = [...(await guild.channels.fetch()).values()];
    console.log(
      `got ${(channelsInGuild ?? []).length} channels from guild: \n${channelsInGuild.map((c) => c?.name).join(", ")}`,
    );
    const channel = channelsInGuild.find(
      (c) => (channelNameIsId ? c?.id : c?.name) === channelName,
    );
    if (!channel?.isTextBased()) {
      throw new Error("Channel not found or is not text-based");
    }

    if (embedData) {
      // Create an embed message if embed data is provided
      const embed = new EmbedBuilder(embedData);
      await channel.send({ content: message, embeds: [embed] });
    } else {
      // Send a normal text message if no embed data is provided
      await channel.send(message);
    }
  }

  async findChannel(
    channelIdentifier: string,
    guildId = "1217866693125341305",
  ) {
    await this.waitForClientReady();
    const channelNameIsId = channelIdentifier.match(/^\d{17,19}$/);
    const guild = await this.client.guilds.fetch(guildId);
    const channelsInGuild = [...(await guild.channels.fetch()).values()];
    const channel = channelsInGuild.find(
      (c) => (channelNameIsId ? c?.id : c?.name) === channelIdentifier,
    );
    return channel;
  }

  async fetchAllChannelsInGuild(guildId = "1217866693125341305") {
    await this.waitForClientReady();
    const guild = await this.client.guilds.fetch(guildId);
    return [...(await guild.channels.fetch()).values()];
  }
}

export const discord = new DiscordManager();
