import { REST, Routes, SlashCommandBuilder } from "discord.js";
import "dotenv/config";

const commands = [
    new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Testet, ob der Bot lebt")
        .toJSON(),
];

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID!),
    { body: commands }
);

console.log("Commands registriert.");