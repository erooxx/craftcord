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

// Serializes every read-modify-write against the same guild's config within
// this process, so two interactions touching the same guild (two /setup
// runs, or /setup racing /guilddelete) can't interleave and clobber or
// resurrect each other's writes.
const guildLocks = new Map<string, Promise<unknown>>();

function withGuildLock<T>(guildId: string, fn: () => T): Promise<T> {
    const previous = guildLocks.get(guildId) ?? Promise.resolve();
    const next = previous.then(fn, fn);
    guildLocks.set(guildId, next.then(() => {}, () => {}));
    return next;
}

function updateGuildConfig(guildId: string, patch: Partial<GuildConfig>): Promise<void> {
    return withGuildLock(guildId, () => {
        const existing = readConfig(guildId);
        writeConfig(guildId, { locale: existing.locale ?? "en", ...existing, ...patch });
    });
}

export function saveGuildLocale(guildId: string, locale: Locale): Promise<void> {
    return updateGuildConfig(guildId, { locale });
}

export function getGuildLocale(guildId: string): Locale | undefined {
    return readConfig(guildId).locale;
}

export function saveGuildProfessionRoles(guildId: string, professionRoles: Record<string, string>): Promise<void> {
    return updateGuildConfig(guildId, { professionRoles });
}

export function getGuildProfessionRoles(guildId: string): Record<string, string> | undefined {
    return readConfig(guildId).professionRoles;
}

export function saveCraftingChannel(guildId: string, channelId: string): Promise<void> {
    return updateGuildConfig(guildId, { craftingChannelId: channelId });
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

export function deleteGuildConfig(guildId: string): Promise<void> {
    return withGuildLock(guildId, () => {
        const path = configPath(guildId);
        if (existsSync(path)) {
            unlinkSync(path);
        }
    });
}
