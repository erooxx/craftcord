import { ActionRowBuilder, ChannelSelectMenuBuilder, ChannelType, ChatInputCommandInteraction, ComponentType, MessageFlags } from "discord.js";
import { text } from "../i18n/translations.js";
import { buildWelcomeEmbed, buildRulesEmbed, buildLogoAttachment } from "../welcomeMessage.js";
import { awaitSingleComponent } from "../interactions/collector.js";

export async function handlePostWelcome(interaction: ChatInputCommandInteraction) {
    if (interaction.user.id !== process.env.OWNER_ID) {
        await interaction.reply({ content: text.postwelcome.restricted, flags: MessageFlags.Ephemeral });
        return;
    }

    if (!interaction.guild) {
        await interaction.reply({ content: text.common.guildOnly, flags: MessageFlags.Ephemeral });
        return;
    }

    const guild = interaction.guild;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const welcomeChannel = guild.channels.cache.find(
        c => c.type === ChannelType.GuildText && c.name === "welcome"
    );

    if (welcomeChannel && welcomeChannel.type === ChannelType.GuildText) {
        await welcomeChannel.send({ embeds: [buildWelcomeEmbed(guild), buildRulesEmbed()], files: [buildLogoAttachment()] });
        await interaction.editReply({ content: text.postwelcome.posted(`${welcomeChannel}`) });
        return;
    }

    const pickerRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId("postwelcome_channel_picker")
            .setChannelTypes(ChannelType.GuildText)
            .setPlaceholder(text.postwelcome.pickChannelPlaceholder),
    );

    const pickerMessage = await interaction.editReply({
        content: text.postwelcome.pickChannelPrompt,
        components: [pickerRow],
    });

    const pickerInteraction = await awaitSingleComponent(pickerMessage, ComponentType.ChannelSelect, interaction.user.id);
    if (!pickerInteraction) {
        await interaction.editReply({ content: text.postwelcome.timedOut, components: [] });
        return;
    }

    await pickerInteraction.deferUpdate();

    const channelId = pickerInteraction.values[0];
    const chosenChannel = await guild.channels.fetch(channelId);

    if (!chosenChannel || chosenChannel.type !== ChannelType.GuildText) {
        await pickerInteraction.editReply({ content: text.postwelcome.invalidChannel, components: [] });
        return;
    }

    await chosenChannel.send({ embeds: [buildWelcomeEmbed(guild), buildRulesEmbed()], files: [buildLogoAttachment()] });
    await pickerInteraction.editReply({ content: text.postwelcome.posted(`${chosenChannel}`), components: [] });
}
