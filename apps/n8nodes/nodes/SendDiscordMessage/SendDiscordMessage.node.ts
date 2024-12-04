import { ChannelType, Guild, TextChannel } from "discord.js";
import {
  IDataObject,
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from "n8n-workflow";

import { discord } from "@ape-analytics/services";

export class SendDiscordMessage implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Send Message to Discord",
    name: "sendDiscordMessage",
    icon: "file:ape.png",
    group: ["output"],
    version: 1,
    description:
      "Sends a message to a specified Discord channel in a selected server",
    defaults: {
      name: "Send Discord Message",
    },
    inputs: ["main"],
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
      {
        displayName: "Channel Name or ID",
        name: "channel",
        type: "options",
        typeOptions: {
          loadOptionsMethod: "getChannels",
        },
        default: "",
        placeholder: "Channel ID or name",
        description:
          "The Discord channel to send the message to.  This node will work with channel names, but using the formal channel ID is recommended.",
      },
      {
        displayName: "Message Text",
        name: "messageText",
        type: "string",
        default: "",
        placeholder: "Hello, world!",
        description: "The message to send",
      },
      {
        displayName: "Send as Embed",
        name: "sendAsEmbed",
        type: "boolean",
        default: false,
        description: "Send the message as an embed (rich content)",
      },
      {
        displayName: "Embed Title",
        name: "embedTitle",
        type: "string",
        default: "",
        displayOptions: {
          show: {
            sendAsEmbed: [true],
          },
        },
        description: "Title for the embed, if sent as an embed",
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
      getChannels: async function (
        this: ILoadOptionsFunctions,
      ): Promise<INodePropertyOptions[]> {
        while (!this.getCurrentNodeParameter("guildId")) {
          console.log("Waiting for node parameter guildId...");
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        const guildId = this.getCurrentNodeParameter("guildId") as string;
        console.log(`guildId: ${guildId}`);
        try {
          console.log("Fetching channels for guild" + guildId + "...");
          const channels =
            await discord.discord.fetchAllChannelsInGuild(guildId);
          console.log(`Got ${channels.length} channels`);
          return channels
            .filter((channel) => channel.type === ChannelType.GuildText)
            .map((channel) => ({
              name: channel.name,
              value: channel.id,
            }));
        } catch (error) {
          console.log("Error fetching channels: " + error.message);
          throw new NodeOperationError(
            this.getNode(),
            `Failed to fetch channels: ${error.message}`,
          );
        }
      },
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const outputItems: INodeExecutionData[] = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      const server = this.getNodeParameter("server", itemIndex, "") as string;
      const channel = this.getNodeParameter("channel", itemIndex, "") as string;
      const messageText = this.getNodeParameter(
        "messageText",
        itemIndex,
        "",
      ) as string;
      const sendAsEmbed = this.getNodeParameter(
        "sendAsEmbed",
        itemIndex,
        false,
      ) as boolean;
      const embedTitle = sendAsEmbed
        ? (this.getNodeParameter("embedTitle", itemIndex, "") as string)
        : "";

      try {
        // Resolve the server and channel to IDs
        const guild: Guild =
          (await discord.discord.getGuildWithName(server)) ||
          (await discord.discord.client.guilds.fetch(server));
        if (!guild) throw new Error("Guild not found");

        const discordChannel = (await discord.discord.findChannel(
          channel,
        )) as TextChannel;
        if (!discordChannel) throw new Error("Channel not found");

        // Sending message to Discord channel
        const embed = sendAsEmbed
          ? { title: embedTitle, description: messageText }
          : undefined;
        await discord.discord.sendMessageToChannel(
          messageText,
          discordChannel.id,
          embed,
          guild.id,
        );

        // Push processed data to the output
        outputItems.push({
          json: { server, channel, messageText, success: true },
        });
      } catch (error) {
        if (this.continueOnFail()) {
          outputItems.push({
            json: {
              server,
              channel,
              messageText,
              success: false,
              error: error.message,
            },
          });
        } else {
          // Propagate the detailed error and item index for better error handling
          throw new NodeOperationError(this.getNode(), error, { itemIndex });
        }
      }
    }

    return [outputItems];
  }
}
