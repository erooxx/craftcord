import {
    Client,
    GatewayIntentBits,
    Events,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    ChannelSelectMenuBuilder,
    ChannelType,
    ComponentType,
    ButtonInteraction,
} from "discord.js";
import "dotenv/config";
import { saveGuildLocale, saveGuildProfessionRoles, saveCraftingChannel, Locale } from "./guildConfig.js";
import { loadRecipeCatalog } from "./recipeCatalog.js";
import { matchProfessionRoles, createMissingRoles } from "./roleSync.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (c) => {
    console.log(`Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "ping") {
        await interaction.reply("Pong.");
    }
    if(interaction.commandName === "setup") {
        if (!interaction.guildId) {
            await interaction.reply({ content: "This command only works in a server.", flags: MessageFlags.Ephemeral });
            return;
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId("setup_locale_en")
                .setLabel("English")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("setup_locale_de")
                .setLabel("Deutsch")
                .setStyle(ButtonStyle.Secondary),
        );

        const message = await interaction.reply({
            content: "Which language do you prefer?",
            components: [row],
            flags: MessageFlags.Ephemeral,
            fetchReply: true,
        });

        const collector = message.createMessageComponentCollector({
            filter: (i) => i.user.id === interaction.user.id,
            time: 60_000,
            max: 1,
        });

        const localeConfirmations = {
            de: "Die Sprache ist nun auf Deutsch eingestellt.",
            en: "The language has been set to English.",
        };

        const rolePrompts = {
            de: (found: number, total: number, missingNames: string) =>
                `${found}/${total} Berufsrollen gefunden. Fehlend: ${missingNames}\nSollen die fehlenden Rollen jetzt erstellt werden?`,
            en: (found: number, total: number, missingNames: string) =>
                `${found}/${total} profession roles found. Missing: ${missingNames}\nShould the missing roles be created now?`,
        };

        const allFoundMessages = {
            de: "Alle Berufsrollen wurden gefunden.",
            en: "All profession roles were found.",
        };

        const checkingRolesMessages = {
            de: "Rollen werden geprüft, einen Moment bitte...",
            en: "Checking roles, please give me a moment...",
        };

        const creatingRolesMessages = {
            de: "Rollen werden erstellt, einen Moment bitte...",
            en: "Creating roles, please give me a moment...",
        };

        const rolesCreatedMessages = {
            de: "Die fehlenden Rollen wurden erstellt.",
            en: "The missing roles have been created.",
        };

        const rolesSkippedMessages = {
            de: "Ok, es wurden keine neuen Rollen erstellt.",
            en: "Ok, no new roles were created.",
        };

        const timedOutMessages = {
            de: "Zeit abgelaufen, bitte /setup erneut ausführen.",
            en: "Timed out, please run /setup again.",
        };

        const channelPrompts = {
            de: "Soll ich einen Channel #crafting-orders anlegen, oder möchtest du einen bestehenden Channel auswählen?",
            en: "Should I create a #crafting-orders channel, or would you like to select an existing one?",
        };

        const selectChannelPrompts = {
            de: "Welchen Channel soll ich für Crafting-Anfragen nutzen?",
            en: "Which channel should I use for crafting requests?",
        };

        const channelCreatedMessages = {
            de: (channelId: string) => `<#${channelId}> wurde erstellt und als Crafting-Channel festgelegt.`,
            en: (channelId: string) => `<#${channelId}> has been created and set as the crafting channel.`,
        };

        const channelSelectedMessages = {
            de: (channelId: string) => `<#${channelId}> wurde als Crafting-Channel festgelegt.`,
            en: (channelId: string) => `<#${channelId}> has been set as the crafting channel.`,
        };

        async function promptChannelSetup(
            currentInteraction: ButtonInteraction,
            locale: Locale,
            precedingText: string,
            isFirstResponse: boolean
        ) {
            const channelRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId("setup_channel_create")
                    .setLabel(locale === "de" ? "#crafting-orders erstellen" : "Create #crafting-orders")
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId("setup_channel_select")
                    .setLabel(locale === "de" ? "Bestehenden Channel wählen" : "Select existing channel")
                    .setStyle(ButtonStyle.Secondary),
            );

            const payload = {
                content: `${precedingText}\n${channelPrompts[locale]}`,
                components: [channelRow],
            };

            if (isFirstResponse) {
                await currentInteraction.update(payload);
            } else {
                await currentInteraction.editReply(payload);
            }

            const channelCollector = message.createMessageComponentCollector({
                filter: (i) => i.user.id === interaction.user.id,
                time: 60_000,
                max: 1,
            });

            channelCollector.on("collect", async (channelChoiceInteraction) => {
                if (channelChoiceInteraction.customId === "setup_channel_create") {
                    const channel = await interaction.guild!.channels.create({
                        name: "crafting-orders",
                        type: ChannelType.GuildText,
                        reason: "Craftcord Setup",
                    });

                    saveCraftingChannel(interaction.guildId!, channel.id);

                    await channelChoiceInteraction.update({
                        content: channelCreatedMessages[locale](channel.id),
                        components: [],
                    });
                    return;
                }

                const selectRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                    new ChannelSelectMenuBuilder()
                        .setCustomId("setup_channel_picker")
                        .setChannelTypes(ChannelType.GuildText)
                        .setPlaceholder(selectChannelPrompts[locale]),
                );

                await channelChoiceInteraction.update({
                    content: selectChannelPrompts[locale],
                    components: [selectRow],
                });

                const pickerCollector = message.createMessageComponentCollector({
                    componentType: ComponentType.ChannelSelect,
                    filter: (i) => i.user.id === interaction.user.id,
                    time: 60_000,
                    max: 1,
                });

                pickerCollector.on("collect", async (pickerInteraction) => {
                    const channelId = pickerInteraction.values[0];
                    saveCraftingChannel(interaction.guildId!, channelId);

                    await pickerInteraction.update({
                        content: channelSelectedMessages[locale](channelId),
                        components: [],
                    });
                });

                pickerCollector.on("end", (collected) => {
                    if (collected.size === 0) {
                        channelChoiceInteraction.editReply({ content: timedOutMessages[locale], components: [] });
                    }
                });
            });

            channelCollector.on("end", (collected) => {
                if (collected.size === 0) {
                    currentInteraction.editReply({ content: timedOutMessages[locale], components: [] });
                }
            });
        }

        collector.on("collect", async (buttonInteraction) => {
            const locale = buttonInteraction.customId === "setup_locale_de" ? "de" : "en";

            saveGuildLocale(interaction.guildId!, locale);

            await buttonInteraction.update({
                content: checkingRolesMessages[locale],
                components: [],
            });

            const catalog = loadRecipeCatalog();
            const guild = interaction.guild!;
            const { matched, missing } = await matchProfessionRoles(guild, catalog, locale);

            if (missing.length === 0) {
                saveGuildProfessionRoles(guild.id, Object.fromEntries(matched));
                await promptChannelSetup(
                    buttonInteraction,
                    locale,
                    `${localeConfirmations[locale]}\n${allFoundMessages[locale]}`,
                    false
                );
                return;
            }

            const missingNames = missing.map(p => p.name[locale]).join(", ");

            const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId("setup_create_roles_yes")
                    .setLabel(locale === "de" ? "Ja, erstellen" : "Yes, create")
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId("setup_create_roles_no")
                    .setLabel(locale === "de" ? "Nein" : "No")
                    .setStyle(ButtonStyle.Danger),
            );

            await buttonInteraction.editReply({
                content: `${localeConfirmations[locale]}\n${rolePrompts[locale](matched.size, catalog.length, missingNames)}`,
                components: [confirmRow],
            });

            const confirmCollector = message.createMessageComponentCollector({
                filter: (i) => i.user.id === interaction.user.id,
                time: 60_000,
                max: 1,
            });

            confirmCollector.on("collect", async (confirmInteraction) => {
                const createRoles = confirmInteraction.customId === "setup_create_roles_yes";

                if (!createRoles) {
                    saveGuildProfessionRoles(guild.id, Object.fromEntries(matched));
                    await promptChannelSetup(confirmInteraction, locale, rolesSkippedMessages[locale], true);
                    return;
                }

                await confirmInteraction.update({
                    content: creatingRolesMessages[locale],
                    components: [],
                });

                const created = await createMissingRoles(guild, missing, locale);
                const allRoles = new Map([...matched, ...created]);

                saveGuildProfessionRoles(guild.id, Object.fromEntries(allRoles));

                await promptChannelSetup(confirmInteraction, locale, rolesCreatedMessages[locale], false);
            });

            confirmCollector.on("end", (collected) => {
                if (collected.size === 0) {
                    interaction.editReply({ content: timedOutMessages[locale], components: [] });
                }
            });
        });

        collector.on("end", (collected) => {
            if (collected.size === 0) {
                interaction.editReply({ content: "Timed out, please run /setup again.", components: [] });
            }
        });
    }
});

client.login(process.env.DISCORD_TOKEN);
