import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

export type Locale = "de" | "en";

interface GuildConfig {
    locale: Locale;
    professionRoles?: Record<string, string>;
    craftingChannelId?: string;
}

function configPath(guildId: string): string {
    return `guild-config/${guildId}.json`;
}

function readConfig(guildId: string): Partial<GuildConfig> {
    const path = configPath(guildId);
    if (!existsSync(path)) {
        return {};
    }

    return JSON.parse(readFileSync(path, "utf-8"));
}

function writeConfig(guildId: string, config: GuildConfig) {
    mkdirSync("guild-config", { recursive: true });
    writeFileSync(configPath(guildId), JSON.stringify(config, null, 2));
}

export function saveGuildLocale(guildId: string, locale: Locale) {
    const existing = readConfig(guildId);
    writeConfig(guildId, { ...existing, locale });
}

export function getGuildLocale(guildId: string): Locale | undefined {
    return readConfig(guildId).locale;
}

export function saveGuildProfessionRoles(guildId: string, professionRoles: Record<string, string>) {
    const existing = readConfig(guildId);
    writeConfig(guildId, { locale: existing.locale ?? "en", ...existing, professionRoles });
}

export function getGuildProfessionRoles(guildId: string): Record<string, string> | undefined {
    return readConfig(guildId).professionRoles;
}

export function saveCraftingChannel(guildId: string, channelId: string) {
    const existing = readConfig(guildId);
    writeConfig(guildId, { locale: existing.locale ?? "en", ...existing, craftingChannelId: channelId });
}

export function getCraftingChannel(guildId: string): string | undefined {
    return readConfig(guildId).craftingChannelId;
}
