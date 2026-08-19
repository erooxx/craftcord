import { readFileSync, writeFileSync, unlinkSync, mkdirSync, existsSync } from "node:fs";
import type { Locale } from "./i18n/locales.js";

export type { Locale };

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

export function getFullGuildConfig(guildId: string): Partial<GuildConfig> | null {
    if (!existsSync(configPath(guildId))) {
        return null;
    }
    return readConfig(guildId);
}

export function deleteGuildConfig(guildId: string) {
    const path = configPath(guildId);
    if (existsSync(path)) {
        unlinkSync(path);
    }
}
