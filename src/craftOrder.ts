import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    Embed,
    ButtonInteraction,
    MessageFlags,
    ThreadChannel,
    ThreadAutoArchiveDuration,
} from "discord.js";
import type { Locale } from "./guildConfig.js";
import type { RecipeIndexEntry } from "./recipeIndex.js";
import { PROFESSION_COLORS } from "./professions.js";
import { getGuildLocale } from "./guildConfig.js";

export const CLAIM_BUTTON_ID = "craft_claim";
export const COMPLETE_BUTTON_ID = "craft_complete";
export const RELEASE_BUTTON_ID = "craft_release";
export const CANCEL_BUTTON_ID = "craft_cancel";

const REQUESTER_MARKER = "🧑";
const CRAFTER_MARKER = "🔨";

const UNCLAIMED_VALUE = "—";

const BLANK_FIELD = { name: "​", value: "​", inline: true };

const requestedByLabels = { de: "Angefragt von", en: "Requested by" };
const crafterLabels = { de: "Handwerker:in", en: "Crafter" };
const qualityLabels = { de: "Qualität", en: "Quality" };
const urgencyLabels = { de: "Dringlichkeit", en: "Urgency" };
const reagentsLabels = { de: "Reagenzien", en: "Reagents" };
const professionLabels = { de: "Beruf", en: "Profession" };

const urgencyValueLabels = {
    de: { asap: "Sofort", whenever: "Wenn's passt" },
    en: { asap: "ASAP", whenever: "Whenever it fits" },
};

const claimButtonLabels = { de: "Übernehmen", en: "Claim" };
const completeButtonLabels = { de: "Abschließen", en: "Complete" };
const releaseButtonLabels = { de: "Zurückgeben", en: "Revoke" };
const cancelButtonLabels = { de: "Auftrag abbrechen", en: "Cancel order" };

const cannotClaimOwnOrderMessages = {
    de: "Du kannst deine eigene Anfrage nicht übernehmen.",
    en: "You can't claim your own order.",
};

const onlyExecutorMessages = {
    de: "Nur die ausführende Person kann diesen Auftrag abschließen.",
    en: "Only the person who claimed this order can complete it.",
};

const onlyRequesterMessages = {
    de: "Nur die anfragende Person kann diesen Auftrag abbrechen.",
    en: "Only the requester can cancel this order.",
};

const onlyExecutorCanReleaseMessages = {
    de: "Nur die ausführende Person kann diesen Auftrag zurückgeben.",
    en: "Only the person who claimed this order can release it.",
};

const orderCompletedMessages = {
    de: (executorId: string) => `Auftrag abgeschlossen von <@${executorId}>`,
    en: (executorId: string) => `Order completed by <@${executorId}>`,
};

function formatReagents(recipeEntry: RecipeIndexEntry, locale: Locale): string | undefined {
    const lines = [
        ...recipeEntry.reagents.map(r => `${r.quantity}x ${r.name[locale]}`),
        ...recipeEntry.additionalReagents.map(r => r.name[locale]),
    ];
    return lines.length > 0 ? lines.join("\n") : undefined;
}

export function buildCraftOrderEmbed(params: {
    recipeEntry: RecipeIndexEntry;
    quality: number;
    urgency: string;
    requesterId: string;
    roleId: string;
    locale: Locale;
}): EmbedBuilder {
    const { recipeEntry, quality, urgency, requesterId, roleId, locale } = params;

    const embed = new EmbedBuilder()
        .setTitle(recipeEntry.recipeName[locale])
        .setColor(PROFESSION_COLORS[recipeEntry.professionId] ?? 0x5865f2)
        .addFields(
            { name: `${REQUESTER_MARKER} ${requestedByLabels[locale]}`, value: `<@${requesterId}>`, inline: true },
            { name: `${CRAFTER_MARKER} ${crafterLabels[locale]}`, value: UNCLAIMED_VALUE, inline: true },
            BLANK_FIELD,
            { name: qualityLabels[locale], value: `T${quality}`, inline: true },
            { name: urgencyLabels[locale], value: urgencyValueLabels[locale][urgency as "asap" | "whenever"], inline: true },
            BLANK_FIELD,
            { name: professionLabels[locale], value: `<@&${roleId}>`, inline: false },
        );

    if (recipeEntry.iconUrl) {
        embed.setThumbnail(recipeEntry.iconUrl);
    }

    const reagentsText = formatReagents(recipeEntry, locale);
    if (reagentsText) {
        embed.addFields({ name: reagentsLabels[locale], value: reagentsText });
    }

    return embed;
}

export function buildClaimCancelRow(locale: Locale): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(CLAIM_BUTTON_ID).setLabel(claimButtonLabels[locale]).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(CANCEL_BUTTON_ID).setLabel(cancelButtonLabels[locale]).setStyle(ButtonStyle.Danger),
    );
}

function buildCompleteReleaseCancelRow(locale: Locale): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(COMPLETE_BUTTON_ID).setLabel(completeButtonLabels[locale]).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(RELEASE_BUTTON_ID).setLabel(releaseButtonLabels[locale]).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(CANCEL_BUTTON_ID).setLabel(cancelButtonLabels[locale]).setStyle(ButtonStyle.Danger),
    );
}

function extractUserId(embed: Embed, marker: string): string | undefined {
    const field = embed.fields.find(f => f.name.startsWith(marker));
    const match = field?.value.match(/<@(\d+)>/);
    return match?.[1];
}

function withFieldValue(embed: Embed, marker: string, value: string): EmbedBuilder {
    const updatedFields = embed.fields.map(field =>
        field.name.startsWith(marker) ? { ...field, value } : field
    );
    return EmbedBuilder.from(embed).setFields(updatedFields);
}

async function renameThreadIcon(thread: ThreadChannel, icon: string) {
    const withoutIcon = thread.name.replace(/^\S+\s*/, "");
    await thread.setName(`${icon} ${withoutIcon}`.slice(0, 100));
}

function resolveLocale(guildId: string | null): Locale {
    return (guildId && getGuildLocale(guildId)) || "en";
}

export async function handleClaimButton(interaction: ButtonInteraction) {
    const embedData = interaction.message.embeds[0];
    if (!embedData) return;

    const locale = resolveLocale(interaction.guildId);
    const requesterId = extractUserId(embedData, REQUESTER_MARKER);

    if (interaction.user.id === requesterId) {
        await interaction.reply({ content: cannotClaimOwnOrderMessages[locale], flags: MessageFlags.Ephemeral });
        return;
    }

    const embed = withFieldValue(embedData, CRAFTER_MARKER, `<@${interaction.user.id}>`);

    await interaction.update({
        embeds: [embed],
        components: [buildCompleteReleaseCancelRow(locale)],
    });

    if (interaction.channel?.isThread()) {
        await renameThreadIcon(interaction.channel, CRAFTER_MARKER);
    }
}

export async function handleReleaseButton(interaction: ButtonInteraction) {
    const embedData = interaction.message.embeds[0];
    if (!embedData) return;

    const locale = resolveLocale(interaction.guildId);
    const executorId = extractUserId(embedData, CRAFTER_MARKER);

    if (interaction.user.id !== executorId) {
        await interaction.reply({ content: onlyExecutorCanReleaseMessages[locale], flags: MessageFlags.Ephemeral });
        return;
    }

    const embed = withFieldValue(embedData, CRAFTER_MARKER, UNCLAIMED_VALUE);

    await interaction.update({
        embeds: [embed],
        components: [buildClaimCancelRow(locale)],
    });

    if (interaction.channel?.isThread()) {
        await renameThreadIcon(interaction.channel, "❔");
    }
}

export async function handleCompleteButton(interaction: ButtonInteraction) {
    const embedData = interaction.message.embeds[0];
    if (!embedData) return;

    const locale = resolveLocale(interaction.guildId);
    const executorId = extractUserId(embedData, CRAFTER_MARKER);

    if (interaction.user.id !== executorId) {
        await interaction.reply({ content: onlyExecutorMessages[locale], flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.update({ components: [] });

    if (interaction.channel?.isThread()) {
        const thread = interaction.channel;
        await thread.setLocked(true);
        await thread.setAutoArchiveDuration(ThreadAutoArchiveDuration.OneHour);
        await thread.send(orderCompletedMessages[locale](interaction.user.id));
        await renameThreadIcon(thread, "✅");
    }
}

export async function handleCancelButton(interaction: ButtonInteraction) {
    const embedData = interaction.message.embeds[0];
    if (!embedData) return;

    const locale = resolveLocale(interaction.guildId);
    const requesterId = extractUserId(embedData, REQUESTER_MARKER);

    if (interaction.user.id !== requesterId) {
        await interaction.reply({ content: onlyRequesterMessages[locale], flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferUpdate();

    if (interaction.channel?.isThread()) {
        await interaction.channel.delete("Craftcord order cancelled");
    }
}
