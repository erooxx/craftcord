import type { Guild } from "discord.js";
import type { CatalogProfession } from "./recipeCatalog.js";
import type { Locale } from "./guildConfig.js";
import { PROFESSION_COLORS } from "./professions.js";

export async function matchProfessionRoles(
    guild: Guild,
    professions: CatalogProfession[],
    locale: Locale
): Promise<{ matched: Map<number, string>; missing: CatalogProfession[] }> {
    const guildRoles = await guild.roles.fetch();

    const matched = new Map<number, string>();
    const missing: CatalogProfession[] = [];

    for (const profession of professions) {
        const role = guildRoles.find(role => {
            return role.name.toLowerCase() === profession.name.de.toLowerCase() || role.name.toLowerCase() === profession.name.en.toLowerCase()
        })
        if(role !== undefined) {
            matched.set(profession.id, role.id);

            const targetName = profession.name[locale];
            if (role.name !== targetName) {
                await role.setName(targetName, "Craftcord Setup – locale changed");
            }
        } else {
            missing.push(profession)
        }
    }

    return { matched, missing };
}

export async function createMissingRoles(
    guild: Guild,
    missing: CatalogProfession[],
    locale: Locale
): Promise<Map<number, string>> {
    const created = new Map<number, string>();

    for (const profession of missing) {
        const role = await guild.roles.create({
            name: profession.name[locale],
            color: PROFESSION_COLORS[profession.id],
            mentionable: true,
            hoist: false,
            permissions: [],
            reason: "Craftcord Setup",
        });

        created.set(profession.id, role.id);
    }

    return created;
}
