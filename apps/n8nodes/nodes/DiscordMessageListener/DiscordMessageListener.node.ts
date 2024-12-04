import { ChannelType, Client, GatewayIntentBits } from "discord.js";
import {
  IDataObject,
  ILoadOptionsFunctions,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
  ITriggerFunctions,
  ITriggerResponse,
  NodeOperationError,
} from "n8n-workflow";

import { discord } from "@ape-analytics/services";

export class DiscordMessageListener implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Discord Message Listener",
    name: "discordMessageListener",
    icon: "file:ape.png",
    group: ["trigger"],
    version: 1,
    description:
      "Triggers the workflow based on various message events in Discord",
    defaults: {
      name: "Discord Message Listener",
    },
    inputs: [],
    outputs: ["main"],
    properties: [
      {
        displayName: "Guild ID",
        name: "guildId",
        type: "string",
        default: "",
        description: "The ID of the Discord guild (server)",
      },
      {
        displayName: "Channel IDs",
        name: "channelIds",
        type: "multiOptions",
        typeOptions: {
          loadOptionsMethod: "getChannels",
        },
        default: [],
        description: "The Discord channel IDs to listen to for messages",
      },
      {
        displayName: "Message Filters",
        name: "messageFilters",
        type: "collection",
        placeholder: "Add Filter",
        default: {},
        options: [
          {
            displayName: "From User ID",
            name: "fromUserId",
            type: "string",
            default: "",
            description: "Only trigger on messages from this User ID",
          },
          {
            displayName: "Contains Text",
            name: "containsText",
            type: "string",
            default: "",
            description: "Only trigger on messages containing this text",
          },
        ],
      },
    ],
  };

  methods = {
    loadOptions: {
      // Define getChannels within loadOptions
      getChannels: async function (
        this: ILoadOptionsFunctions,
      ): Promise<INodePropertyOptions[]> {
        const guildId = this.getCurrentNodeParameter("guildId") as string;
        if (!guildId) {
          throw new NodeOperationError(
            this.getNode(),
            "Guild ID must be provided to load channels.",
          );
        }

        try {
          const channels =
            await discord.discord.fetchAllChannelsInGuild(guildId);
          return channels
            .filter((channel) => channel.type === ChannelType.GuildText)
            .map((channel) => ({
              name: channel.name,
              value: channel.id,
            }));
        } catch (error) {
          throw new NodeOperationError(
            this.getNode(),
            `Failed to fetch channels: ${error.message}`,
          );
        }
      },
    },
  };

  async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
    const guildId = this.getNodeParameter("guildId", 0) as string;
    const channelIds = this.getNodeParameter("channelIds", 0) as string[];
    const messageFilters = this.getNodeParameter(
      "messageFilters",
      0,
    ) as IDataObject;

    const discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
    discordClient.login(process.env.DISCORD_BOT_TOKEN).catch((err) => {
      console.error("Error logging in to Discord:", err);
    });

    const manualTriggerFunction = async () => {
      await new Promise<void>((resolve, reject) => {
        discordClient.on("ready", async () => {
          console.log("Discord client is ready and listening for messages.");

          // Setting up event listener for messageCreate
          discordClient.on("messageCreate", async (message) => {
            if (!message.guild || !message.channel.isTextBased()) {
              return; // Ensures we're in a guild and channel is text-based
            }

            // Check guild and channel
            if (
              message.guild.id !== guildId ||
              !channelIds.includes(message.channel.id)
            ) {
              return; // Message does not match the guild or channel filter
            }

            // Check message filters
            if (
              messageFilters.fromUserId &&
              message.author.id !== messageFilters.fromUserId
            ) {
              return; // Message does not match the user filter
            }
            if (
              messageFilters.containsText &&
              typeof messageFilters.containsText === "string" &&
              !message.content.includes(messageFilters.containsText)
            ) {
              return; // Message does not contain the specified text
            }

            // Check channel name
            if (
              messageFilters.channelName &&
              message.channel.id !== messageFilters.channelName
            ) {
              return; // Message does not match the channel name filter
            }

            // Construct message data
            const messageData = {
              id: message.id,
              content: message.content,
              author: {
                id: message.author.id,
                username: message.author.username,
                discriminator: message.author.discriminator,
              },
              channelId: message.channel.id,
              guildId: message.guild.id,
              attachments: message.attachments.size
                ? message.attachments.map((a) => a.url)
                : [],
            };

            // Emit the data
            this.emit([this.helpers.returnJsonArray([messageData])]);
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
