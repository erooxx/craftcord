import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelSelectMenuBuilder,
    ChannelType,
    ChatInputCommandInteraction,
    ComponentType,
    Guild,
    MessageFlags,
    RepliableInteraction,
    TextChannel,
} from "discord.js";
import { SUPPORTED_LOCALES } from "../i18n/locales.js";
import { text } from "../i18n/translations.js";
import { getGuildLocale, Locale, saveCraftingChannel, saveGuildLocale, saveGuildProfessionRoles } from "../guildConfig.js";
import { loadRecipeCatalog } from "../catalog/recipeCatalog.js";
import { createMissingRoles, matchProfessionRoles } from "../roleSync.js";
import { buildCraftingChannelInfoEmbed } from "../craftOrder.js";
import { awaitSingleComponent } from "../interactions/collector.js";

async function finalizeCraftingChannel(channel: TextChannel, guildId: string, locale: Locale) {
    await saveCraftingChannel(guildId, channel.id);

    const infoMessage = await channel.send({ embeds: [buildCraftingChannelInfoEmbed(locale)] });
    await infoMessage.pin();
}

// `respondTo` must already have had its initial response (reply/update)
// consumed by the caller — every step here only ever calls editReply on it,
// never reply/update, so callers control which interaction "owns" the
// ephemeral message at each point.
async function promptChannelSetup(
    respondTo: RepliableInteraction,
    guild: Guild,
    locale: Locale,
    precedingText: string,
    userId: string,
): Promise<void> {
    const channels = await guild.channels.fetch();
    const existingChannel = channels.find(
        c => c !== null && c.type === ChannelType.GuildText && c.name.toLowerCase() === "crafting-orders"
    );

    if (existingChannel && existingChannel.type === ChannelType.GuildText) {
        await respondTo.editReply({ content: text.setup.settingUpChannel[locale], components: [] });
        await finalizeCraftingChannel(existingChannel, guild.id, locale);
        await respondTo.editReply({
            content: `${precedingText}\n${text.setup.channelFound[locale](existingChannel.id)}\n\n${text.setup.completed[locale]}`,
            components: [],
        });
        return;
    }

    const channelRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("setup_channel_create").setLabel(text.setup.createChannelButton[locale]).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("setup_channel_select").setLabel(text.setup.selectChannelButton[locale]).setStyle(ButtonStyle.Secondary),
    );

    const message = await respondTo.editReply({
        content: `${precedingText}\n${text.setup.channelPrompt[locale]}`,
        components: [channelRow],
    });

    const channelChoice = await awaitSingleComponent(message, ComponentType.Button, userId);
    if (!channelChoice) {
        await respondTo.editReply({ content: text.setup.timedOut[locale], components: [] });
        return;
    }

    if (channelChoice.customId === "setup_channel_create") {
        await channelChoice.update({ content: text.setup.settingUpChannel[locale], components: [] });

        const channel = await guild.channels.create({
            name: "crafting-orders",
            type: ChannelType.GuildText,
            reason: "Craftcord Setup",
        });

        await finalizeCraftingChannel(channel, guild.id, locale);

        await channelChoice.editReply({
            content: `${precedingText}\n${text.setup.channelCreated[locale](channel.id)}\n\n${text.setup.completed[locale]}`,
            components: [],
        });
        return;
    }

    const selectRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId("setup_channel_picker")
            .setChannelTypes(ChannelType.GuildText)
            .setPlaceholder(text.setup.selectChannelPrompt[locale]),
    );

    const pickerMessage = await channelChoice.update({
        content: text.setup.selectChannelPrompt[locale],
        components: [selectRow],
        fetchReply: true,
    });

    const pickerInteraction = await awaitSingleComponent(pickerMessage, ComponentType.ChannelSelect, userId);
    if (!pickerInteraction) {
        await channelChoice.editReply({ content: text.setup.timedOut[locale], components: [] });
        return;
    }

    const channelId = pickerInteraction.values[0];
    await pickerInteraction.update({ content: text.setup.settingUpChannel[locale], components: [] });

    const selectedChannel = await guild.channels.fetch(channelId);
    if (selectedChannel && selectedChannel.type === ChannelType.GuildText) {
        await finalizeCraftingChannel(selectedChannel, guild.id, locale);
    }

    await pickerInteraction.editReply({
        content: `${precedingText}\n${text.setup.channelSelected[locale](channelId)}\n\n${text.setup.completed[locale]}`,
        components: [],
    });
}

export async function handleSetup(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
        await interaction.reply({ content: text.common.guildOnly, flags: MessageFlags.Ephemeral });
        return;
    }

    const guildId = interaction.guildId;
    const guild = interaction.guild!;
    const userId = interaction.user.id;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...SUPPORTED_LOCALES.map((localeOption, i) =>
            new ButtonBuilder()
                .setCustomId(`setup_locale_${localeOption.code}`)
                .setLabel(localeOption.label)
                .setStyle(i === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary)
        ),
    );

    const message = await interaction.reply({
        content: text.setup.pickLanguage,
        components: [row],
        flags: MessageFlags.Ephemeral,
        fetchReply: true,
    });

    const localeChoice = await awaitSingleComponent(message, ComponentType.Button, userId);
    if (!localeChoice) {
        const fallbackLocale: Locale = getGuildLocale(guildId) ?? "en";
        await interaction.editReply({ content: text.setup.timedOut[fallbackLocale], components: [] });
        return;
    }

    const localeCode = localeChoice.customId.replace("setup_locale_", "");
    const locale: Locale = (SUPPORTED_LOCALES.find(l => l.code === localeCode)?.code ?? "en") as Locale;

    await saveGuildLocale(guildId, locale);
    await localeChoice.update({ content: text.setup.checkingRoles[locale], components: [] });

    const catalog = loadRecipeCatalog();
    const { matched, missing } = await matchProfessionRoles(guild, catalog, locale);

    if (missing.length === 0) {
        await saveGuildProfessionRoles(guildId, Object.fromEntries(matched));
        await promptChannelSetup(
            localeChoice,
            guild,
            locale,
            `${text.setup.localeConfirmation[locale]}\n${text.setup.allRolesFound[locale](catalog.length)}`,
            userId,
        );
        return;
    }

    const missingNames = missing.map(p => p.name[locale]).join(", ");

    const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("setup_create_roles_yes").setLabel(text.setup.confirmCreateRolesButton[locale]).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("setup_create_roles_no").setLabel(text.setup.declineCreateRolesButton[locale]).setStyle(ButtonStyle.Danger),
    );

    const confirmMessage = await localeChoice.editReply({
        content: `${text.setup.localeConfirmation[locale]}\n${text.setup.rolePrompt[locale](matched.size, catalog.length, missingNames)}`,
        components: [confirmRow],
    });

    const confirmChoice = await awaitSingleComponent(confirmMessage, ComponentType.Button, userId);
    if (!confirmChoice) {
        await localeChoice.editReply({ content: text.setup.timedOut[locale], components: [] });
        return;
    }

    const createRoles = confirmChoice.customId === "setup_create_roles_yes";

    if (!createRoles) {
        await saveGuildProfessionRoles(guildId, Object.fromEntries(matched));
        const skippedText = `${text.setup.localeConfirmation[locale]}\n${text.setup.rolesSkipped[locale](matched.size, catalog.length)}`;
        await confirmChoice.update({ content: skippedText, components: [] });
        await promptChannelSetup(confirmChoice, guild, locale, skippedText, userId);
        return;
    }

    await confirmChoice.update({ content: text.setup.creatingRoles[locale], components: [] });

    const allRolesSoFar = new Map(matched);
    const created = await createMissingRoles(guild, missing, locale, (professionId, roleId) => {
        allRolesSoFar.set(professionId, roleId);
        saveGuildProfessionRoles(guildId, Object.fromEntries(allRolesSoFar)).catch(err =>
            console.error(`Failed to persist incrementally created role for guild ${guildId}:`, err)
        );
    });

    const createdText = `${text.setup.localeConfirmation[locale]}\n${text.setup.rolesCreated[locale](created.size, allRolesSoFar.size)}`;
    await promptChannelSetup(confirmChoice, guild, locale, createdText, userId);
}
