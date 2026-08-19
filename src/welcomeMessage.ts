import { EmbedBuilder, Guild, ChannelType, AttachmentBuilder } from "discord.js";
import { LINKS } from "./links.js";

const LOGO_FILENAME = "craftcord_logo.png";
const LOGO_PATH = `assets/${LOGO_FILENAME}`;

function findTextChannel(guild: Guild, name: string) {
    return guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === name);
}

export function buildLogoAttachment(): AttachmentBuilder {
    return new AttachmentBuilder(LOGO_PATH, { name: LOGO_FILENAME });
}

export function buildWelcomeEmbed(guild: Guild): EmbedBuilder {
    const supportChannel = findTextChannel(guild, "support-forum");
    const updatesChannel = findTextChannel(guild, "dev-updates");
    const craftingChannel = findTextChannel(guild, "crafting-orders");

    return new EmbedBuilder()
        .setTitle("👋 Welcome to Craftcord!")
        .setThumbnail(`attachment://${LOGO_FILENAME}`)
        .setColor(0x5865f2)
        .setDescription(
            "Craftcord organizes crafting requests in World of Warcraft guilds. " +
            "Use `/craft` in a server's crafting channel to request an item, or `/setup` (admin only) to configure the bot for your own guild."
        )
        .addFields(
            {
                name: "Try it out",
                value: craftingChannel ? `Head to ${craftingChannel} and run \`/craft\`.` : "Try `/craft` in #crafting-orders.",
            },
            {
                name: "Questions?",
                value: supportChannel ? `Ask in ${supportChannel}.` : "Ask in #support-forum.",
            },
            {
                name: "Updates",
                value: updatesChannel ? `Follow ${updatesChannel} for news and breaking changes.` : "Follow #dev-updates.",
            },
            {
                name: "Links",
                value: `[GitHub](${LINKS.github}) • [Privacy Policy](${LINKS.privacyPolicy}) • [Terms of Service](${LINKS.termsOfService})`,
            },
        );
}
