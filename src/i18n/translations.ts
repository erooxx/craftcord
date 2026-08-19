export const text = {
    common: {
        guildOnly: "This command only works in a server.",
        unexpectedError: {
            de: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
            en: "Something went wrong. Please try again.",
        },
    },

    postwelcome: {
        restricted: "This command is restricted.",
        pickChannelPrompt: "No #welcome channel found. Which channel should I post in?",
        pickChannelPlaceholder: "No #welcome channel found — pick one",
        invalidChannel: "Invalid channel.",
        posted: (channel: string) => `Posted in ${channel}.`,
        timedOut: "Timed out, please run /postwelcome again.",
    },

    setup: {
        pickLanguage: "Which language do you prefer?",

        localeConfirmation: {
            de: "Die Sprache ist nun auf Deutsch eingestellt.",
            en: "The language has been set to English.",
        },

        checkingRoles: {
            de: "Rollen werden geprüft, einen Moment bitte...",
            en: "Checking roles, please give me a moment...",
        },

        creatingRoles: {
            de: "Rollen werden erstellt, einen Moment bitte...",
            en: "Creating roles, please give me a moment...",
        },

        allRolesFound: {
            de: (total: number) => `Alle ${total} Berufsrollen wurden gefunden, keine mussten neu erstellt werden.`,
            en: (total: number) => `All ${total} profession roles were found, none needed to be created.`,
        },

        rolePrompt: {
            de: (found: number, total: number, missingNames: string) =>
                `${found}/${total} Berufsrollen gefunden. Fehlend: ${missingNames}\nSollen die fehlenden Rollen jetzt erstellt werden?`,
            en: (found: number, total: number, missingNames: string) =>
                `${found}/${total} profession roles found. Missing: ${missingNames}\nShould the missing roles be created now?`,
        },

        rolesCreated: {
            de: (createdCount: number, total: number) => `${createdCount} neue Rolle(n) erstellt. Insgesamt sind jetzt ${total} Berufsrollen eingerichtet.`,
            en: (createdCount: number, total: number) => `${createdCount} new role(s) created. ${total} profession roles are now set up in total.`,
        },

        rolesSkipped: {
            de: (found: number, total: number) => `${found}/${total} Rollen gefunden, es wurden keine neuen Rollen erstellt.`,
            en: (found: number, total: number) => `${found}/${total} roles found, no new roles were created.`,
        },

        confirmCreateRolesButton: { de: "Ja, erstellen", en: "Yes, create" },
        declineCreateRolesButton: { de: "Nein", en: "No" },

        timedOut: {
            de: "Zeit abgelaufen, bitte /setup erneut ausführen.",
            en: "Timed out, please run /setup again.",
        },

        channelPrompt: {
            de: "Soll ich einen Channel #crafting-orders anlegen, oder möchtest du einen bestehenden Channel auswählen?",
            en: "Should I create a #crafting-orders channel, or would you like to select an existing one?",
        },

        createChannelButton: { de: "#crafting-orders erstellen", en: "Create #crafting-orders" },
        selectChannelButton: { de: "Bestehenden Channel wählen", en: "Select existing channel" },

        selectChannelPrompt: {
            de: "Welchen Channel soll ich für Crafting-Anfragen nutzen?",
            en: "Which channel should I use for crafting requests?",
        },

        settingUpChannel: {
            de: "Channel wird eingerichtet, einen Moment bitte...",
            en: "Setting up the channel, please give me a moment...",
        },

        channelCreated: {
            de: (channelId: string) => `<#${channelId}> wurde erstellt und als Crafting-Channel festgelegt.`,
            en: (channelId: string) => `<#${channelId}> has been created and set as the crafting channel.`,
        },

        channelSelected: {
            de: (channelId: string) => `<#${channelId}> wurde als Crafting-Channel festgelegt.`,
            en: (channelId: string) => `<#${channelId}> has been set as the crafting channel.`,
        },

        channelFound: {
            de: (channelId: string) => `Es existiert bereits ein Channel <#${channelId}>, dieser wurde als Crafting-Channel übernommen.`,
            en: (channelId: string) => `A channel <#${channelId}> already exists and has been set as the crafting channel.`,
        },

        completed: {
            de: "Setup abgeschlossen",
            en: "Setup completed",
        },
    },

    guildInfo: {
        noConfig: {
            de: "Für diesen Server ist keine Konfiguration gespeichert.",
            en: "No configuration is stored for this server.",
        },
        title: { de: "Gespeicherte Konfiguration", en: "Stored configuration" },
        guildIdLabel: { de: "Server-ID", en: "Guild ID" },
        localeLabel: { de: "Sprache", en: "Locale" },
        craftingChannelLabel: { de: "Crafting-Channel", en: "Crafting channel" },
        professionRolesLabel: {
            de: "Berufsrollen (Berufs-ID → Rolle)",
            en: "Profession roles (profession ID → role)",
        },
        none: { de: "Keine", en: "None" },
    },

    guildDelete: {
        noConfig: {
            de: "Für diesen Server ist keine Konfiguration gespeichert — nichts zu löschen.",
            en: "No configuration is stored for this server — nothing to delete.",
        },
        confirmPrompt: {
            de: "Damit wird die gesamte gespeicherte Konfiguration für diesen Server gelöscht (Sprache, Crafting-Channel, Berufsrollen-Zuordnung). Das kann nicht rückgängig gemacht werden — danach muss `/setup` erneut ausgeführt werden. Fortfahren?",
            en: "This deletes all stored configuration for this server (locale, crafting channel, profession role mappings). This cannot be undone — you'll need to run `/setup` again afterward. Continue?",
        },
        confirmButton: { de: "Löschen", en: "Delete" },
        cancelButton: { de: "Abbrechen", en: "Cancel" },
        cancelled: { de: "Abgebrochen. Nichts wurde gelöscht.", en: "Cancelled. Nothing was deleted." },
        deleted: {
            de: "Gelöscht. Führe `/setup` aus, um Craftcord erneut zu konfigurieren.",
            en: "Deleted. Run `/setup` to configure Craftcord again.",
        },
        timedOut: { de: "Zeit abgelaufen — nichts wurde gelöscht.", en: "Timed out — nothing was deleted." },
    },

    craft: {
        noChannel: {
            de: "Für diese Gilde wurde noch kein Crafting-Channel eingerichtet. Bitte zuerst /setup ausführen.",
            en: "No crafting channel has been set up for this server yet. Please run /setup first.",
        },

        wrongChannel: {
            de: (channelId: string) => `Dieser Befehl funktioniert nur in <#${channelId}>.`,
            en: (channelId: string) => `This command only works in <#${channelId}>.`,
        },

        unknownItem: {
            de: "Dieses Item wurde nicht erkannt. Bitte wähle einen Vorschlag aus der Liste.",
            en: "That item wasn't recognized. Please pick a suggestion from the list.",
        },

        noRole: {
            de: "Für den zugehörigen Beruf ist keine Rolle eingerichtet. Bitte /setup erneut ausführen.",
            en: "No role is set up for the corresponding profession. Please run /setup again.",
        },

        roleGone: {
            de: "Die zugehörige Berufsrolle existiert nicht mehr. Bitte /setup erneut ausführen.",
            en: "The corresponding profession role no longer exists. Please run /setup again.",
        },

        channelGone: {
            de: "Der Crafting-Channel ist nicht mehr verfügbar. Bitte /setup erneut ausführen.",
            en: "The crafting channel is no longer available. Please run /setup again.",
        },

        requestCreated: {
            de: (threadId: string) => `Anfrage erstellt: <#${threadId}>`,
            en: (threadId: string) => `Request created: <#${threadId}>`,
        },

        order: {
            requestedByLabel: { de: "Angefragt von", en: "Requested by" },
            crafterLabel: { de: "Crafter", en: "Crafter" },
            qualityLabel: { de: "Qualität", en: "Quality" },
            urgencyLabel: { de: "Dringlichkeit", en: "Urgency" },
            reagentsLabel: { de: "Reagenzien", en: "Reagents" },
            professionLabel: { de: "Beruf", en: "Profession" },

            urgencyValues: {
                de: { asap: "Sofort", whenever: "Wenn's passt" },
                en: { asap: "ASAP", whenever: "Whenever it fits" },
            },

            claimButton: { de: "Übernehmen", en: "Claim" },
            completeButton: { de: "Abschließen", en: "Complete" },
            releaseButton: { de: "Zurückgeben", en: "Revoke" },
            cancelButton: { de: "Auftrag abbrechen", en: "Cancel order" },

            cannotClaimOwn: {
                de: "Du kannst deine eigene Anfrage nicht übernehmen.",
                en: "You can't claim your own order.",
            },

            alreadyClaimed: {
                de: "Dieser Auftrag wurde bereits übernommen.",
                en: "This order has already been claimed.",
            },

            onlyExecutorCanComplete: {
                de: "Nur die ausführende Person kann diesen Auftrag abschließen.",
                en: "Only the person who claimed this order can complete it.",
            },

            onlyRequesterCanCancel: {
                de: "Nur die anfragende Person kann diesen Auftrag abbrechen.",
                en: "Only the requester can cancel this order.",
            },

            onlyExecutorCanRelease: {
                de: "Nur die ausführende Person kann diesen Auftrag zurückgeben.",
                en: "Only the person who claimed this order can release it.",
            },

            completedBy: {
                de: (executorId: string) => `Auftrag abgeschlossen von <@${executorId}>`,
                en: (executorId: string) => `Order completed by <@${executorId}>`,
            },
        },

        info: {
            title: { de: "📜 So funktionieren Crafting-Anfragen", en: "📜 How Crafting Requests Work" },

            description: {
                de: "Nutze `/craft` in diesem Channel, um ein Item anzufragen. Wähle das Item per Autocomplete, optional Qualität (T1–T5, Standard ist die höchste) und Dringlichkeit (Standard ist Sofort).",
                en: "Use `/craft` in this channel to request an item. Pick the item via autocomplete, optionally set a quality (T1–T5, defaults to the highest) and urgency (defaults to ASAP).",
            },

            nextStepsLabel: { de: "Was danach passiert", en: "What happens next" },
            nextStepsValue: {
                de: "Ich erstelle einen privaten Thread nur für dich und alle mit der passenden Berufsrolle. Niemand sonst kann ihn sehen.",
                en: "I'll create a private thread just for you and everyone with the matching profession role. Nobody else can see it.",
            },

            craftersLabel: { de: "Für Handwerker:innen", en: "For crafters" },
            craftersValue: {
                de: "Klick auf **Übernehmen**, um die Anfrage anzunehmen — danach kannst nur du sie **Abschließen** oder **Zurückgeben**.",
                en: "Click **Claim** to take the order — after that, only you can **Complete** or **Revoke** it.",
            },

            requestersLabel: { de: "Für Anfragende", en: "For requesters" },
            requestersValue: {
                de: "Du kannst den Auftrag jederzeit über **Auftrag abbrechen** stornieren — das löscht den Thread sofort.",
                en: "You can cancel the order at any time via **Cancel order** — this deletes the thread immediately.",
            },
        },
    },
} as const;
