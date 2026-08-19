import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import "dotenv/config";

// Usable by any guild the bot is invited to — registered globally so every
// server gets them without us touching deploy-commands.ts per guild.
const globalCommands = [
    new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Is the bot alive?")
        .toJSON(),
    new SlashCommandBuilder()
        .setName("setup")
        .setDescription("Configures bot for this server")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .toJSON(),
    new SlashCommandBuilder()
        .setName("craft")
        .setDescription("Request an item of the current expansion to be crafted")
        .addStringOption(option =>
            option.setName("item")
                .setDescription("The item you want crafted")
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addIntegerOption(option =>
            option.setName("quality")
                .setDescription("Desired crafting quality (defaults to the highest)")
                .setRequired(false)
                .addChoices(
                    { name: "T1", value: 1 },
                    { name: "T2", value: 2 },
                    { name: "T3", value: 3 },
                    { name: "T4", value: 4 },
                    { name: "T5", value: 5 },
                )
        )
        .addStringOption(option =>
            option.setName("urgency")
                .setDescription("How urgently do you need this? (defaults to ASAP)")
                .setRequired(false)
                .addChoices(
                    { name: "ASAP", value: "asap" },
                    { name: "Whenever it fits", value: "whenever" },
                )
        )
        .toJSON(),
    new SlashCommandBuilder()
        .setName("guildinfo")
        .setDescription("Shows what Craftcord has stored for this server")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .toJSON(),
    new SlashCommandBuilder()
        .setName("guilddelete")
        .setDescription("Deletes everything Craftcord has stored for this server")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .toJSON(),
];

// Only relevant on the Craftcord home server, kept guild-scoped on purpose.
const homeGuildCommands = [
    new SlashCommandBuilder()
        .setName("postwelcome")
        .setDescription("Posts the welcome message in #welcome (owner only)")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON(),
];

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID!),
    { body: globalCommands }
);

await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID!),
    { body: homeGuildCommands }
);

console.log("Commands registered (global + home guild).");