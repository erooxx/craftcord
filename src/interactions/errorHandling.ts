import { Interaction, MessageFlags } from "discord.js";
import { getGuildLocale, Locale } from "../guildConfig.js";
import { text } from "../i18n/translations.js";

function resolveErrorLocale(interaction: Interaction): Locale {
    try {
        return (interaction.guildId && getGuildLocale(interaction.guildId)) || "en";
    } catch {
        return "en";
    }
}

export async function reportInteractionError(interaction: Interaction, error: unknown, context: string) {
    console.error(`[${context}]`, error);

    if (!interaction.isRepliable()) return;

    const locale = resolveErrorLocale(interaction);

    try {
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: text.common.unexpectedError[locale], components: [] });
        } else {
            await interaction.reply({ content: text.common.unexpectedError[locale], flags: MessageFlags.Ephemeral });
        }
    } catch (replyError) {
        console.error(`[${context}] failed to notify user:`, replyError);
    }
}

export function withErrorHandling<T extends Interaction>(context: string, handler: (interaction: T) => Promise<void>) {
    return async (interaction: T) => {
        try {
            await handler(interaction);
        } catch (error) {
            await reportInteractionError(interaction, error, context);
        }
    };
}
