import { ChannelType, ChatInputCommandInteraction, MessageFlags, ThreadAutoArchiveDuration } from "discord.js";
import { text } from "../i18n/translations.js";
import { getCraftingChannel, getGuildLocale, getGuildProfessionRoles, Locale } from "../guildConfig.js";
import type { RecipeIndexEntry } from "../catalog/recipeIndex.js";
import { buildClaimCancelRow, buildCraftOrderEmbed } from "../craftOrder.js";

export async function handleCraft(interaction: ChatInputCommandInteraction, recipeIndex: RecipeIndexEntry[]) {
    const guildId = interaction.guildId;
    if (!guildId || !interaction.guild) {
        await interaction.reply({ content: text.common.guildOnly, flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const locale: Locale = getGuildLocale(guildId) ?? "en";

    const craftingChannelId = getCraftingChannel(guildId);
    if (!craftingChannelId) {
        await interaction.editReply(text.craft.noChannel[locale]);
        return;
    }

    if (interaction.channelId !== craftingChannelId) {
        await interaction.editReply(text.craft.wrongChannel[locale](craftingChannelId));
        return;
    }

    const recipeId = Number(interaction.options.getString("item", true));
    const recipeEntry = recipeIndex.find(entry => entry.recipeId === recipeId);

    if (!recipeEntry) {
        await interaction.editReply(text.craft.unknownItem[locale]);
        return;
    }

    const quality = interaction.options.getInteger("quality") ?? 5;
    const urgency = interaction.options.getString("urgency") ?? "asap";

    const professionRoles = getGuildProfessionRoles(guildId);
    const roleId = professionRoles?.[recipeEntry.professionId];

    if (!roleId) {
        await interaction.editReply(text.craft.noRole[locale]);
        return;
    }

    const role = await interaction.guild.roles.fetch(roleId);
    if (!role) {
        await interaction.editReply(text.craft.roleGone[locale]);
        return;
    }

    const craftingChannel = await interaction.guild.channels.fetch(craftingChannelId);
    if (!craftingChannel || craftingChannel.type !== ChannelType.GuildText) {
        await interaction.editReply(text.craft.channelGone[locale]);
        return;
    }

    const itemName = recipeEntry.recipeName[locale];
    const threadName = `❔ T${quality}: ${itemName}`.slice(0, 100);

    const thread = await craftingChannel.threads.create({
        name: threadName,
        type: ChannelType.PrivateThread,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
        reason: "Craftcord /craft request",
    });

    await interaction.guild.members.fetch();

    const memberIds = new Set(role.members.keys());
    memberIds.add(interaction.user.id);

    try {
        for (const memberId of memberIds) {
            await thread.members.add(memberId);
        }
    } catch (error) {
        // Don't leave an empty, undiscoverable thread behind if we couldn't
        // finish adding everyone who needs to see it.
        await thread.delete("Craftcord: failed to add members to order thread").catch(() => {});
        throw error;
    }

    const orderEmbed = buildCraftOrderEmbed({
        recipeEntry,
        quality,
        urgency,
        requesterId: interaction.user.id,
        roleId: role.id,
        locale,
    });

    await thread.send({
        embeds: [orderEmbed],
        components: [buildClaimCancelRow(locale)],
    });

    await interaction.editReply(text.craft.requestCreated[locale](thread.id));
}
