import { Client, GatewayIntentBits } from "discord.js";
import {
  ILoadOptionsFunctions,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
  ITriggerFunctions,
  ITriggerResponse,
  NodeOperationError,
} from "n8n-workflow";

import { discord } from "@ape-analytics/services";

export class DiscordMemberJoin implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Discord Member Join",
    name: "discordMemberJoin",
    icon: "file:ape.png",
    group: ["trigger"],
    version: 1,
    description:
      "Triggers the workflow when a new member joins a Discord guild",
    defaults: {
      name: "Discord Member Join",
    },
    inputs: [],
    outputs: ["main"],
    properties: [
      {
        displayName: "Discord Guild",
        name: "guildId",
        type: "options",
        typeOptions: {
          loadOptionsMethod: "getGuilds",
        },
        default: "",
        description:
          "The Discord guild to monitor for new members.  The default value here is the ID of the Ape Analytics Discord server.",
      },
    ],
  };

  methods = {
    loadOptions: {
      // Define getGuilds within loadOptions
      getGuilds: async function (
        this: ILoadOptionsFunctions,
      ): Promise<INodePropertyOptions[]> {
        try {
          const guilds = await discord.discord.getAllDiscordServers();
          return guilds.map((guild) => ({
            name: guild.name,
            value: guild.id,
          }));
        } catch (error) {
          throw new NodeOperationError(
            this.getNode(),
            `Failed to fetch guilds: ${error.message}`,
          );
        }
      },
    },
  };

  async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
    const guildId = this.getNodeParameter("guildId", 0) as string;

    const discordClient = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
    });

    discordClient.login(process.env.DISCORD_BOT_TOKEN).catch((err) => {
      console.error("Error logging in to Discord:", err);
    });

    const manualTriggerFunction = async () => {
      await new Promise<void>((resolve, reject) => {
        discordClient.on("ready", async () => {
          console.log("Discord client is ready and monitoring member joins.");

          const guild = await discordClient.guilds.fetch(guildId);
          if (!guild) {
            throw new NodeOperationError(this.getNode(), "Guild not found");
          }

          discordClient.on("guildMemberAdd", async (member) => {
            if (member.guild.id === guildId) {
              const memberData = {
                id: member.id,
                username: member.user.username,
                discriminator: member.user.discriminator,
                joinedTimestamp: member.joinedTimestamp,
                guildId: member.guild.id,
              };

              this.emit([this.helpers.returnJsonArray([memberData])]);
            }
          });

          resolve();
        });

        discordClient.on("error", (error) => {
          console.error("Discord Client Error:", error);
          reject(error);
        });
      });
    };

    if (this.getMode() === "trigger") {
      await manualTriggerFunction();
    }

    async function closeFunction() {
      if (discordClient) {
        discordClient.destroy();
      }
    }

    return {
      closeFunction,
      manualTriggerFunction,
    };
  }
}
