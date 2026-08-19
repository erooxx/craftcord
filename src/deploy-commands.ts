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
];

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID!),
    { body: commands }
);

console.log("Commands registered.");