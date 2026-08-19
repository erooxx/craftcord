import {
    Client,
    GatewayIntentBits,
    Events,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    ChannelSelectMenuBuilder,
    ChannelType,
    ComponentType,
    ButtonInteraction,
    Interaction,
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
    getFullGuildConfig,
    deleteGuildConfig,
    Locale,
} from "./guildConfig.js";
import { SUPPORTED_LOCALES } from "./i18n/locales.js";
import { text } from "./i18n/translations.js";
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
import { buildWelcomeEmbed, buildRulesEmbed, buildLogoAttachment } from "./welcomeMessage.js";

process.on("unhandledRejection", (reason) => {
    console.error("Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
});

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.on(Events.Error, (error) => {
    console.error("Discord client error:", error);
});

const recipeIndex = buildRecipeIndex(loadRecipeCatalog());

async function reportInteractionError(interaction: Interaction, error: unknown, context: string) {
    console.error(`[${context}]`, error);

    if (!interaction.isRepliable()) return;

    const locale: Locale = (interaction.guildId && getGuildLocale(interaction.guildId)) || "en";

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

function withErrorHandling<T extends Interaction>(context: string, handler: (interaction: T) => Promise<void>) {
    return async (interaction: T) => {
        try {
            await handler(interaction);
        } catch (error) {
            await reportInteractionError(interaction, error, context);
        }
    };
}

async function finalizeCraftingChannel(channel: TextChannel, guildId: string, locale: Locale) {
    saveCraftingChannel(guildId, channel.id);

    const infoMessage = await channel.send({ embeds: [buildCraftingChannelInfoEmbed(locale)] });
    await infoMessage.pin();
}

client.once(Events.ClientReady, (c) => {
    console.log(`Logged in as ${c.user.tag}`);
});

client.on(Events.GuildDelete, (guild) => {
    try {
        deleteGuildConfig(guild.id);
        console.log(`Deleted stored config for guild ${guild.id} (bot removed)`);
    } catch (error) {
        console.error(`Failed to delete stored config for guild ${guild.id}:`, error);
    }
});

client.on(Events.InteractionCreate, withErrorHandling("interactionCreate", async (interaction) => {
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

        const postWelcomePickerCollector = pickerMessage.createMessageComponentCollector({
            componentType: ComponentType.ChannelSelect,
            filter: (i) => i.user.id === interaction.user.id,
            time: 60_000,
            max: 1,
        });

        postWelcomePickerCollector.on("collect", withErrorHandling("postwelcome:channelPicker", async (pickerInteraction) => {
            await pickerInteraction.deferUpdate();

            const channelId = pickerInteraction.values[0];
            const chosenChannel = await guild.channels.fetch(channelId);

            if (!chosenChannel || chosenChannel.type !== ChannelType.GuildText) {
                await pickerInteraction.editReply({ content: text.postwelcome.invalidChannel, components: [] });
                return;
            }

            await chosenChannel.send({ embeds: [buildWelcomeEmbed(guild), buildRulesEmbed()], files: [buildLogoAttachment()] });
            await pickerInteraction.editReply({ content: text.postwelcome.posted(`${chosenChannel}`), components: [] });
        }));

        postWelcomePickerCollector.on("end", (collected) => {
            if (collected.size === 0) {
                interaction.editReply({ content: text.postwelcome.timedOut, components: [] });
            }
        });
    }

    if(interaction.commandName === "setup") {
        if (!interaction.guildId) {
            await interaction.reply({ content: text.common.guildOnly, flags: MessageFlags.Ephemeral });
            return;
        }

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

        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: (i) => i.user.id === interaction.user.id,
            time: 60_000,
            max: 1,
        });

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
                const placeholder = { content: text.setup.settingUpChannel[locale], components: [] };
                if (isFirstResponse) {
                    await currentInteraction.update(placeholder);
                } else {
                    await currentInteraction.editReply(placeholder);
                }

                await finalizeCraftingChannel(existingChannel, guild.id, locale);

                await currentInteraction.editReply({
                    content: `${precedingText}\n${text.setup.channelFound[locale](existingChannel.id)}\n\n${text.setup.completed[locale]}`,
                    components: [],
                });
                return;
            }

            const channelRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId("setup_channel_create")
                    .setLabel(text.setup.createChannelButton[locale])
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId("setup_channel_select")
                    .setLabel(text.setup.selectChannelButton[locale])
                    .setStyle(ButtonStyle.Secondary),
            );

            const payload = {
                content: `${precedingText}\n${text.setup.channelPrompt[locale]}`,
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

            channelCollector.on("collect", withErrorHandling("setup:channelChoice", async (channelChoiceInteraction) => {
                if (channelChoiceInteraction.customId === "setup_channel_create") {
                    await channelChoiceInteraction.update({
                        content: text.setup.settingUpChannel[locale],
                        components: [],
                    });

                    const channel = await interaction.guild!.channels.create({
                        name: "crafting-orders",
                        type: ChannelType.GuildText,
                        reason: "Craftcord Setup",
                    });

                    await finalizeCraftingChannel(channel, interaction.guildId!, locale);

                    await channelChoiceInteraction.editReply({
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

                await channelChoiceInteraction.update({
                    content: text.setup.selectChannelPrompt[locale],
                    components: [selectRow],
                });

                const pickerCollector = message.createMessageComponentCollector({
                    componentType: ComponentType.ChannelSelect,
                    filter: (i) => i.user.id === interaction.user.id,
                    time: 60_000,
                    max: 1,
                });

                pickerCollector.on("collect", withErrorHandling("setup:channelPicker", async (pickerInteraction) => {
                    const channelId = pickerInteraction.values[0];

                    await pickerInteraction.update({
                        content: text.setup.settingUpChannel[locale],
                        components: [],
                    });

                    const selectedChannel = await interaction.guild!.channels.fetch(channelId);
                    if (selectedChannel && selectedChannel.type === ChannelType.GuildText) {
                        await finalizeCraftingChannel(selectedChannel, interaction.guildId!, locale);
                    }

                    await pickerInteraction.editReply({
                        content: `${precedingText}\n${text.setup.channelSelected[locale](channelId)}\n\n${text.setup.completed[locale]}`,
                        components: [],
                    });
                }));

                pickerCollector.on("end", (collected) => {
                    if (collected.size === 0) {
                        channelChoiceInteraction.editReply({ content: text.setup.timedOut[locale], components: [] });
                    }
                });
            }));

            channelCollector.on("end", (collected) => {
                if (collected.size === 0) {
                    currentInteraction.editReply({ content: text.setup.timedOut[locale], components: [] });
                }
            });
        }

        collector.on("collect", withErrorHandling("setup:localeChoice", async (buttonInteraction) => {
            const localeCode = buttonInteraction.customId.replace("setup_locale_", "");
            const locale: Locale = (SUPPORTED_LOCALES.find(l => l.code === localeCode)?.code ?? "en") as Locale;

            saveGuildLocale(interaction.guildId!, locale);

            await buttonInteraction.update({
                content: text.setup.checkingRoles[locale],
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
                    `${text.setup.localeConfirmation[locale]}\n${text.setup.allRolesFound[locale](catalog.length)}`,
                    false
                );
                return;
            }

            const missingNames = missing.map(p => p.name[locale]).join(", ");

            const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId("setup_create_roles_yes")
                    .setLabel(text.setup.confirmCreateRolesButton[locale])
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId("setup_create_roles_no")
                    .setLabel(text.setup.declineCreateRolesButton[locale])
                    .setStyle(ButtonStyle.Danger),
            );

            await buttonInteraction.editReply({
                content: `${text.setup.localeConfirmation[locale]}\n${text.setup.rolePrompt[locale](matched.size, catalog.length, missingNames)}`,
                components: [confirmRow],
            });

            const confirmCollector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                filter: (i) => i.user.id === interaction.user.id,
                time: 60_000,
                max: 1,
            });

            confirmCollector.on("collect", withErrorHandling("setup:confirmCreateRoles", async (confirmInteraction) => {
                const createRoles = confirmInteraction.customId === "setup_create_roles_yes";

                if (!createRoles) {
                    saveGuildProfessionRoles(guild.id, Object.fromEntries(matched));
                    const skippedText = `${text.setup.localeConfirmation[locale]}\n${text.setup.rolesSkipped[locale](matched.size, catalog.length)}`;
                    await promptChannelSetup(confirmInteraction, locale, skippedText, true);
                    return;
                }

                await confirmInteraction.update({
                    content: text.setup.creatingRoles[locale],
                    components: [],
                });

                const created = await createMissingRoles(guild, missing, locale);
                const allRoles = new Map([...matched, ...created]);

                saveGuildProfessionRoles(guild.id, Object.fromEntries(allRoles));

                const createdText = `${text.setup.localeConfirmation[locale]}\n${text.setup.rolesCreated[locale](created.size, allRoles.size)}`;
                await promptChannelSetup(confirmInteraction, locale, createdText, false);
            }));

            confirmCollector.on("end", (collected) => {
                if (collected.size === 0) {
                    interaction.editReply({ content: text.setup.timedOut[locale], components: [] });
                }
            });
        }));

        collector.on("end", (collected) => {
            if (collected.size === 0) {
                interaction.editReply({ content: text.setup.timedOut.en, components: [] });
            }
        });
    }

    if (interaction.commandName === "craft") {
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

        await interaction.editReply(text.craft.requestCreated[locale](thread.id));
    }

    if (interaction.commandName === "guildinfo") {
        if (!interaction.guildId) {
            await interaction.reply({ content: text.common.guildOnly, flags: MessageFlags.Ephemeral });
            return;
        }

        const config = getFullGuildConfig(interaction.guildId);
        if (!config) {
            await interaction.reply({ content: "No configuration is stored for this server.", flags: MessageFlags.Ephemeral });
            return;
        }

        const roleLines = config.professionRoles && Object.keys(config.professionRoles).length > 0
            ? Object.entries(config.professionRoles).map(([professionId, roleId]) => `${professionId} → <@&${roleId}>`).join("\n")
            : "None";

        const embed = new EmbedBuilder()
            .setTitle("Stored configuration")
            .setColor(0x5865f2)
            .addFields(
                { name: "Locale", value: config.locale ?? "—", inline: true },
                { name: "Crafting channel", value: config.craftingChannelId ? `<#${config.craftingChannelId}>` : "—", inline: true },
                { name: "Profession roles (profession ID → role)", value: roleLines },
            );

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (interaction.commandName === "guilddelete") {
        if (!interaction.guildId) {
            await interaction.reply({ content: text.common.guildOnly, flags: MessageFlags.Ephemeral });
            return;
        }

        const guildId = interaction.guildId;

        if (!getFullGuildConfig(guildId)) {
            await interaction.reply({ content: "No configuration is stored for this server — nothing to delete.", flags: MessageFlags.Ephemeral });
            return;
        }

        const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId("guilddelete_confirm").setLabel("Delete").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("guilddelete_cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary),
        );

        const message = await interaction.reply({
            content: "This deletes all stored configuration for this server (locale, crafting channel, profession role mappings). This cannot be undone — you'll need to run `/setup` again afterward. Continue?",
            components: [confirmRow],
            flags: MessageFlags.Ephemeral,
            fetchReply: true,
        });

        const deleteCollector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: (i) => i.user.id === interaction.user.id,
            time: 60_000,
            max: 1,
        });

        deleteCollector.on("collect", withErrorHandling("guilddelete:confirm", async (buttonInteraction) => {
            if (buttonInteraction.customId === "guilddelete_cancel") {
                await buttonInteraction.update({ content: "Cancelled. Nothing was deleted.", components: [] });
                return;
            }

            deleteGuildConfig(guildId);
            await buttonInteraction.update({ content: "Deleted. Run `/setup` to configure Craftcord again.", components: [] });
        }));

        deleteCollector.on("end", (collected) => {
            if (collected.size === 0) {
                interaction.editReply({ content: "Timed out — nothing was deleted.", components: [] });
            }
        });
    }
}));

client.login(process.env.DISCORD_TOKEN);
