import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, MessageFlags } from "discord.js";
import { text } from "../i18n/translations.js";
import { deleteGuildConfig, getFullGuildConfig } from "../guildConfig.js";
import { awaitSingleComponent } from "../interactions/collector.js";

export async function handleGuildDelete(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
        await interaction.reply({ content: text.common.guildOnly, flags: MessageFlags.Ephemeral });
        return;
    }

    const guildId = interaction.guildId;
    const config = getFullGuildConfig(guildId);
    const locale = config?.locale ?? "en";

    if (!config) {
        await interaction.reply({ content: text.guildDelete.noConfig[locale], flags: MessageFlags.Ephemeral });
        return;
    }

    const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("guilddelete_confirm").setLabel(text.guildDelete.confirmButton[locale]).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("guilddelete_cancel").setLabel(text.guildDelete.cancelButton[locale]).setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({
        content: text.guildDelete.confirmPrompt[locale],
        components: [confirmRow],
        flags: MessageFlags.Ephemeral,
    });
    const message = await interaction.fetchReply();

    const buttonInteraction = await awaitSingleComponent(message, ComponentType.Button, interaction.user.id);
    if (!buttonInteraction) {
        await interaction.editReply({ content: text.guildDelete.timedOut[locale], components: [] });
        return;
    }

    if (buttonInteraction.customId === "guilddelete_cancel") {
        await buttonInteraction.update({ content: text.guildDelete.cancelled[locale], components: [] });
        return;
    }

    await deleteGuildConfig(guildId);
    await buttonInteraction.update({ content: text.guildDelete.deleted[locale], components: [] });
}
