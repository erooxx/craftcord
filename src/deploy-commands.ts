import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import "dotenv/config";

const commands = [
    new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Is the bot alive?")
        .toJSON(),
    new SlashCommandBuilder()
        .setName("setup")
        .setDescription("Configures bot for this server")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .toJSON(),
];

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID!),
    { body: commands }
);

console.log("Commands registered.");