import { EmbedBuilder, Guild, ChannelType, AttachmentBuilder } from "discord.js";
import { LINKS } from "./links.js";

const LOGO_FILENAME = "craftcord_logo.png";
const LOGO_PATH = `assets/${LOGO_FILENAME}`;

const ANNOUNCEMENTS_CHANNEL_ID = "1539341921556635789";
const SUPPORT_FORUM_CHANNEL_ID = "1539350096850845697";

function findTextChannel(guild: Guild, name: string) {
    return guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === name);
}

export function buildLogoAttachment(): AttachmentBuilder {
    return new AttachmentBuilder(LOGO_PATH, { name: LOGO_FILENAME });
}

export function buildWelcomeEmbed(guild: Guild): EmbedBuilder {
    const questionsChannel = findTextChannel(guild, "questions");

    const announcements = `<#${ANNOUNCEMENTS_CHANNEL_ID}>`;
    const supportForum = `<#${SUPPORT_FORUM_CHANNEL_ID}>`;
    const questions = questionsChannel ? `${questionsChannel}` : "#questions";

    return new EmbedBuilder()
        .setTitle("👋 Welcome to Craftcord!")
        .setThumbnail(`attachment://${LOGO_FILENAME}`)
        .setColor(0x5865f2)
        .setDescription(
            "Craftcord organizes crafting requests in World of Warcraft guilds. " +
            "Use `/craft` in a server's crafting channel to request an item, or `/setup` (admin only) to configure the bot for your own guild.\n\n" +
            `Server invite: ${LINKS.discordInvite}`
        )
        .addFields(
            {
                name: "🚀 Get Craftcord",
                value: `Get Craftcord on your server now: ${LINKS.getCraftcord}`,
            },
            {
                name: "❓ Got a question?",
                value: `Check ${supportForum} first for known issues. You can also search this server (\`Ctrl+F\`). Still stuck? Ask in ${questions}.`,
            },
            {
                name: "🐛 Feature requests & bug reports",
                value: `Post them in ${supportForum}.`,
            },
            {
                name: "📢 Stay updated",
                value: `Follow ${announcements} for news and breaking changes.`,
            },
            {
                name: "📖 More info",
                value: "Check out <id:guide> for a full walkthrough — you'll also find our Privacy Policy and Terms of Service there.\n" +
                    "Want to change your onboarding answers later? Head to <id:customize>.\n" +
                    "Manage which channels you see in <id:browse>.",
            },
            {
                name: "🔗 Links",
                value: `[GitHub](${LINKS.github}) • [Privacy Policy](${LINKS.privacyPolicy}) • [Terms of Service](${LINKS.termsOfService})`,
            },
        );
}

export function buildRulesEmbed(): EmbedBuilder {
    return new EmbedBuilder()
        .setTitle("📜 Rules")
        .setColor(0x5865f2)
        .setDescription(
            "By being in this server you agree to follow these rules, and to not be abnormally disruptive " +
            "in ways not covered by the rules. Users may be suspended depending on the severity of their violation(s), at the discretion of the moderators."
        )
        .addFields(
            {
                name: "1️⃣ Use common sense",
                value: "Harassment, NSFW content, and other offensive content is not tolerated. This includes usernames and profile pictures. In essence, follow the [Discord Community Guidelines](https://discord.com/guidelines).",
            },
            {
                name: "2️⃣ Keep discussions on-topic",
                value: "This server is for Craftcord and WoW crafting — not for discussions about politics, religion, etc.",
            },
            {
                name: "3️⃣ Use a friendly tone and inclusive language",
                value: "Try to keep excessively negative comments to a minimum, regardless of subject.",
            },
        );
}
