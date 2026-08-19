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
    ThreadAutoArchiveDuration,
    TextChannel,
} from "discord.js";
import "dotenv/config";
import {
    saveGuildLocale,
    saveGuildProfessionRoles,
    saveCraftingChannel,
    getCraftingChannel,
    getGuildProfessionRoles,
    getGuildLocale,
    Locale,
} from "./guildConfig.js";
import { loadRecipeCatalog } from "./recipeCatalog.js";
import { buildRecipeIndex } from "./recipeIndex.js";
import { matchProfessionRoles, createMissingRoles } from "./roleSync.js";
import {
    buildCraftOrderEmbed,
    buildClaimCancelRow,
    buildCraftingChannelInfoEmbed,
    handleClaimButton,
    handleCompleteButton,
    handleReleaseButton,
    handleCancelButton,
    CLAIM_BUTTON_ID,
    COMPLETE_BUTTON_ID,
    RELEASE_BUTTON_ID,
    CANCEL_BUTTON_ID,
} from "./craftOrder.js";
import { buildWelcomeEmbed } from "./welcomeMessage.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

const recipeIndex = buildRecipeIndex(loadRecipeCatalog());

async function finalizeCraftingChannel(channel: TextChannel, guildId: string, locale: Locale) {
    saveCraftingChannel(guildId, channel.id);

    const infoMessage = await channel.send({ embeds: [buildCraftingChannelInfoEmbed(locale)] });
    await infoMessage.pin();
}

client.once(Events.ClientReady, (c) => {
    console.log(`Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isButton()) {
        if (interaction.customId === CLAIM_BUTTON_ID) {
            await handleClaimButton(interaction);
        } else if (interaction.customId === COMPLETE_BUTTON_ID) {
            await handleCompleteButton(interaction);
        } else if (interaction.customId === RELEASE_BUTTON_ID) {
            await handleReleaseButton(interaction);
        } else if (interaction.customId === CANCEL_BUTTON_ID) {
            await handleCancelButton(interaction);
        }
        return;
    }

    if (interaction.isAutocomplete()) {
        if (interaction.commandName !== "craft") return;

        const locale: Locale = (interaction.guildId && getGuildLocale(interaction.guildId)) || "en";
        const focused = interaction.options.getFocused().toLowerCase();

        const choices = recipeIndex
            .filter(entry => entry.recipeName[locale].toLowerCase().includes(focused))
            .sort((a, b) => a.recipeName[locale].localeCompare(b.recipeName[locale], locale))
            .slice(0, 25)
            .map(entry => ({ name: entry.recipeName[locale], value: String(entry.recipeId) }));

        await interaction.respond(choices);
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "ping") {
        await interaction.reply("Pong.");
    }

    if (interaction.commandName === "postwelcome") {
        if (interaction.user.id !== process.env.OWNER_ID) {
            await interaction.reply({ content: "This command is restricted.", flags: MessageFlags.Ephemeral });
            return;
        }

        if (!interaction.guild) {
            await interaction.reply({ content: "This command only works in a server.", flags: MessageFlags.Ephemeral });
            return;
        }

        const guild = interaction.guild;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const welcomeChannel = guild.channels.cache.find(
            c => c.type === ChannelType.GuildText && c.name === "welcome"
        );

        if (welcomeChannel && welcomeChannel.type === ChannelType.GuildText) {
            await welcomeChannel.send({ embeds: [buildWelcomeEmbed(guild)] });
            await interaction.editReply({ content: `Posted in ${welcomeChannel}.` });
            return;
        }

        const pickerRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId("postwelcome_channel_picker")
                .setChannelTypes(ChannelType.GuildText)
                .setPlaceholder("No #welcome channel found — pick one"),
        );

        const pickerMessage = await interaction.editReply({
            content: "No #welcome channel found. Which channel should I post in?",
            components: [pickerRow],
        });

        const postWelcomePickerCollector = pickerMessage.createMessageComponentCollector({
            componentType: ComponentType.ChannelSelect,
            filter: (i) => i.user.id === interaction.user.id,
            time: 60_000,
            max: 1,
        });

        postWelcomePickerCollector.on("collect", async (pickerInteraction) => {
            await pickerInteraction.deferUpdate();

            const channelId = pickerInteraction.values[0];
            const chosenChannel = await guild.channels.fetch(channelId);

            if (!chosenChannel || chosenChannel.type !== ChannelType.GuildText) {
                await pickerInteraction.editReply({ content: "Invalid channel.", components: [] });
                return;
            }

            await chosenChannel.send({ embeds: [buildWelcomeEmbed(guild)] });
            await pickerInteraction.editReply({ content: `Posted in ${chosenChannel}.`, components: [] });
        });

        postWelcomePickerCollector.on("end", (collected) => {
            if (collected.size === 0) {
                interaction.editReply({ content: "Timed out, please run /postwelcome again.", components: [] });
            }
        });
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
            componentType: ComponentType.Button,
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
            de: (total: number) => `Alle ${total} Berufsrollen wurden gefunden, keine mussten neu erstellt werden.`,
            en: (total: number) => `All ${total} profession roles were found, none needed to be created.`,
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
            de: (createdCount: number, total: number) => `${createdCount} neue Rolle(n) erstellt. Insgesamt sind jetzt ${total} Berufsrollen eingerichtet.`,
            en: (createdCount: number, total: number) => `${createdCount} new role(s) created. ${total} profession roles are now set up in total.`,
        };

        const rolesSkippedMessages = {
            de: (found: number, total: number) => `${found}/${total} Rollen gefunden, es wurden keine neuen Rollen erstellt.`,
            en: (found: number, total: number) => `${found}/${total} roles found, no new roles were created.`,
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

        const channelFoundMessages = {
            de: (channelId: string) => `Es existiert bereits ein Channel <#${channelId}>, dieser wurde als Crafting-Channel übernommen.`,
            en: (channelId: string) => `A channel <#${channelId}> already exists and has been set as the crafting channel.`,
        };

        const setupCompletedMessages = {
            de: "Setup abgeschlossen",
            en: "Setup completed",
        };

        const settingUpChannelMessages = {
            de: "Channel wird eingerichtet, einen Moment bitte...",
            en: "Setting up the channel, please give me a moment...",
        };

        async function promptChannelSetup(
            currentInteraction: ButtonInteraction,
            locale: Locale,
            precedingText: string,
            isFirstResponse: boolean
        ) {
            const guild = interaction.guild!;
            const channels = await guild.channels.fetch();
            const existingChannel = channels.find(
                c => c !== null && c.type === ChannelType.GuildText && c.name.toLowerCase() === "crafting-orders"
            );

            if (existingChannel && existingChannel.type === ChannelType.GuildText) {
                const placeholder = { content: settingUpChannelMessages[locale], components: [] };
                if (isFirstResponse) {
                    await currentInteraction.update(placeholder);
                } else {
                    await currentInteraction.editReply(placeholder);
                }

                await finalizeCraftingChannel(existingChannel, guild.id, locale);

                await currentInteraction.editReply({
                    content: `${precedingText}\n${channelFoundMessages[locale](existingChannel.id)}\n\n${setupCompletedMessages[locale]}`,
                    components: [],
                });
                return;
            }

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
                componentType: ComponentType.Button,
                filter: (i) => i.user.id === interaction.user.id,
                time: 60_000,
                max: 1,
            });

            channelCollector.on("collect", async (channelChoiceInteraction) => {
                if (channelChoiceInteraction.customId === "setup_channel_create") {
                    await channelChoiceInteraction.update({
                        content: settingUpChannelMessages[locale],
                        components: [],
                    });

                    const channel = await interaction.guild!.channels.create({
                        name: "crafting-orders",
                        type: ChannelType.GuildText,
                        reason: "Craftcord Setup",
                    });

                    await finalizeCraftingChannel(channel, interaction.guildId!, locale);

                    await channelChoiceInteraction.editReply({
                        content: `${precedingText}\n${channelCreatedMessages[locale](channel.id)}\n\n${setupCompletedMessages[locale]}`,
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

                    await pickerInteraction.update({
                        content: settingUpChannelMessages[locale],
                        components: [],
                    });

                    const selectedChannel = await interaction.guild!.channels.fetch(channelId);
                    if (selectedChannel && selectedChannel.type === ChannelType.GuildText) {
                        await finalizeCraftingChannel(selectedChannel, interaction.guildId!, locale);
                    }

                    await pickerInteraction.editReply({
                        content: `${precedingText}\n${channelSelectedMessages[locale](channelId)}\n\n${setupCompletedMessages[locale]}`,
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
                    `${localeConfirmations[locale]}\n${allFoundMessages[locale](catalog.length)}`,
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
                componentType: ComponentType.Button,
                filter: (i) => i.user.id === interaction.user.id,
                time: 60_000,
                max: 1,
            });

            confirmCollector.on("collect", async (confirmInteraction) => {
                const createRoles = confirmInteraction.customId === "setup_create_roles_yes";

                if (!createRoles) {
                    saveGuildProfessionRoles(guild.id, Object.fromEntries(matched));
                    const skippedText = `${localeConfirmations[locale]}\n${rolesSkippedMessages[locale](matched.size, catalog.length)}`;
                    await promptChannelSetup(confirmInteraction, locale, skippedText, true);
                    return;
                }

                await confirmInteraction.update({
                    content: creatingRolesMessages[locale],
                    components: [],
                });

                const created = await createMissingRoles(guild, missing, locale);
                const allRoles = new Map([...matched, ...created]);

                saveGuildProfessionRoles(guild.id, Object.fromEntries(allRoles));

                const createdText = `${localeConfirmations[locale]}\n${rolesCreatedMessages[locale](created.size, allRoles.size)}`;
                await promptChannelSetup(confirmInteraction, locale, createdText, false);
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

    if (interaction.commandName === "craft") {
        const guildId = interaction.guildId;
        if (!guildId || !interaction.guild) {
            await interaction.reply({ content: "This command only works in a server.", flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const locale: Locale = getGuildLocale(guildId) ?? "en";

        const craftingChannelId = getCraftingChannel(guildId);
        if (!craftingChannelId) {
            await interaction.editReply(
                locale === "de"
                    ? "Für diese Gilde wurde noch kein Crafting-Channel eingerichtet. Bitte zuerst /setup ausführen."
                    : "No crafting channel has been set up for this server yet. Please run /setup first."
            );
            return;
        }

        if (interaction.channelId !== craftingChannelId) {
            await interaction.editReply(
                locale === "de"
                    ? `Dieser Befehl funktioniert nur in <#${craftingChannelId}>.`
                    : `This command only works in <#${craftingChannelId}>.`
            );
            return;
        }

        const recipeId = Number(interaction.options.getString("item", true));
        const recipeEntry = recipeIndex.find(entry => entry.recipeId === recipeId);

        if (!recipeEntry) {
            await interaction.editReply(
                locale === "de"
                    ? "Dieses Item wurde nicht erkannt. Bitte wähle einen Vorschlag aus der Liste."
                    : "That item wasn't recognized. Please pick a suggestion from the list."
            );
            return;
        }

        const quality = interaction.options.getInteger("quality") ?? 5;
        const urgency = interaction.options.getString("urgency") ?? "asap";

        const professionRoles = getGuildProfessionRoles(guildId);
        const roleId = professionRoles?.[recipeEntry.professionId];

        if (!roleId) {
            await interaction.editReply(
                locale === "de"
                    ? "Für den zugehörigen Beruf ist keine Rolle eingerichtet. Bitte /setup erneut ausführen."
                    : "No role is set up for the corresponding profession. Please run /setup again."
            );
            return;
        }

        const role = await interaction.guild.roles.fetch(roleId);
        if (!role) {
            await interaction.editReply(
                locale === "de"
                    ? "Die zugehörige Berufsrolle existiert nicht mehr. Bitte /setup erneut ausführen."
                    : "The corresponding profession role no longer exists. Please run /setup again."
            );
            return;
        }

        const craftingChannel = await interaction.guild.channels.fetch(craftingChannelId);
        if (!craftingChannel || craftingChannel.type !== ChannelType.GuildText) {
            await interaction.editReply(
                locale === "de"
                    ? "Der Crafting-Channel ist nicht mehr verfügbar. Bitte /setup erneut ausführen."
                    : "The crafting channel is no longer available. Please run /setup again."
            );
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

        for (const memberId of memberIds) {
            await thread.members.add(memberId);
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

        await interaction.editReply(
            locale === "de"
                ? `Anfrage erstellt: <#${thread.id}>`
                : `Request created: <#${thread.id}>`
        );
    }
});

client.login(process.env.DISCORD_TOKEN);
