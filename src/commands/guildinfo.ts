import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from "discord.js";
import { text } from "../i18n/translations.js";
import { getFullGuildConfig } from "../guildConfig.js";

export async function handleGuildInfo(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
        await interaction.reply({ content: text.common.guildOnly, flags: MessageFlags.Ephemeral });
        return;
    }

    const config = getFullGuildConfig(interaction.guildId);
    const locale = config?.locale ?? "en";

    if (!config) {
        await interaction.reply({ content: text.guildInfo.noConfig[locale], flags: MessageFlags.Ephemeral });
        return;
    }

    const roleLines = config.professionRoles && Object.keys(config.professionRoles).length > 0
        ? Object.entries(config.professionRoles).map(([professionId, roleId]) => `${professionId} → <@&${roleId}>`).join("\n")
        : text.guildInfo.none[locale];

    const embed = new EmbedBuilder()
        .setTitle(text.guildInfo.title[locale])
        .setColor(0x5865f2)
        .addFields(
            { name: text.guildInfo.guildIdLabel[locale], value: interaction.guildId, inline: true },
            { name: text.guildInfo.localeLabel[locale], value: config.locale ?? "—", inline: true },
            { name: text.guildInfo.craftingChannelLabel[locale], value: config.craftingChannelId ? `<#${config.craftingChannelId}>` : "—", inline: true },
            { name: text.guildInfo.professionRolesLabel[locale], value: roleLines },
        );

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
