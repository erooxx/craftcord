import { Client, Events, GatewayIntentBits } from "discord.js";
import "dotenv/config";
import { getGuildLocale, Locale, deleteGuildConfig } from "./guildConfig.js";
import { loadRecipeCatalog } from "./catalog/recipeCatalog.js";
import { buildRecipeIndex } from "./catalog/recipeIndex.js";
import {
    handleClaimButton,
    handleCompleteButton,
    handleReleaseButton,
    handleCancelButton,
    CLAIM_BUTTON_ID,
    COMPLETE_BUTTON_ID,
    RELEASE_BUTTON_ID,
    CANCEL_BUTTON_ID,
} from "./craftOrder.js";
import { withErrorHandling } from "./interactions/errorHandling.js";
import { handlePing } from "./commands/ping.js";
import { handleSetup } from "./commands/setup.js";
import { handleCraft } from "./commands/craft.js";
import { handlePostWelcome } from "./commands/postwelcome.js";
import { handleGuildInfo } from "./commands/guildinfo.js";
import { handleGuildDelete } from "./commands/guilddelete.js";

process.on("unhandledRejection", (reason) => {
    console.error("Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
});

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.on(Events.Error, (error) => {
    console.error("Discord client error:", error);
});

const recipeIndex = buildRecipeIndex(loadRecipeCatalog());

client.once(Events.ClientReady, (c) => {
    console.log(`Logged in as ${c.user.tag}`);
});

client.on(Events.GuildDelete, (guild) => {
    // discord.js also fires this when a guild becomes temporarily
    // unavailable during a Discord-side outage, not only when the bot is
    // actually removed — only delete stored config for a real removal.
    if (!guild.available) return;

    try {
        deleteGuildConfig(guild.id);
        console.log(`Deleted stored config for guild ${guild.id} (bot removed)`);
    } catch (error) {
        console.error(`Failed to delete stored config for guild ${guild.id}:`, error);
    }
});

client.on(Events.InteractionCreate, withErrorHandling("interactionCreate", async (interaction) => {
    if (interaction.isButton()) {
        if (interaction.customId === CLAIM_BUTTON_ID) {
            await handleClaimButton(interaction);
        } else if (interaction.customId === COMPLETE_BUTTON_ID) {
            await handleCompleteButton(interaction);
        } else if (interaction.customId === RELEASE_BUTTON_ID) {
            await handleReleaseButton(interaction);
        } else if (interaction.customId === CANCEL_BUTTON_ID) {
            await handleCancelButton(interaction);
        }
        return;
    }

    if (interaction.isAutocomplete()) {
        if (interaction.commandName !== "craft") return;

        const locale: Locale = (interaction.guildId && getGuildLocale(interaction.guildId)) || "en";
        const focused = interaction.options.getFocused().toLowerCase();

        const choices = recipeIndex
            .filter(entry => entry.recipeName[locale].toLowerCase().includes(focused))
            .sort((a, b) => a.recipeName[locale].localeCompare(b.recipeName[locale], locale))
            .slice(0, 25)
            .map(entry => ({ name: entry.recipeName[locale], value: String(entry.recipeId) }));

        await interaction.respond(choices);
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    switch (interaction.commandName) {
        case "ping":
            await handlePing(interaction);
            break;
        case "setup":
            await handleSetup(interaction);
            break;
        case "craft":
            await handleCraft(interaction, recipeIndex);
            break;
        case "postwelcome":
            await handlePostWelcome(interaction);
            break;
        case "guildinfo":
            await handleGuildInfo(interaction);
            break;
        case "guilddelete":
            await handleGuildDelete(interaction);
            break;
    }
}));

client.login(process.env.DISCORD_TOKEN);
