import type { Guild } from "discord.js";
import type { CatalogProfession } from "./catalog/recipeCatalog.js";
import type { Locale } from "./guildConfig.js";
import { PROFESSION_COLORS } from "./catalog/professions.js";

export async function matchProfessionRoles(
    guild: Guild,
    professions: CatalogProfession[],
    locale: Locale
): Promise<{ matched: Map<number, string>; missing: CatalogProfession[]; renameFailed: boolean }> {
    const guildRoles = await guild.roles.fetch();

    const rolesByLowercaseName = new Map(guildRoles.map(role => [role.name.toLowerCase(), role]));

    const matched = new Map<number, string>();
    const missing: CatalogProfession[] = [];
    let renameFailed = false;

    for (const profession of professions) {
        const role = rolesByLowercaseName.get(profession.name.de.toLowerCase())
            ?? rolesByLowercaseName.get(profession.name.en.toLowerCase());

        if (role !== undefined) {
            matched.set(profession.id, role.id);

            const targetName = profession.name[locale];
            if (role.name !== targetName) {
                // Renaming needs the bot's own role to sit above this role
                // in the hierarchy — a guild that hasn't moved it up yet
                // will 403 here. The role is already correctly matched by
                // ID either way, so a failed rename is cosmetic and
                // shouldn't fail the whole /setup flow.
                try {
                    await role.setName(targetName, "Craftcord Setup – locale changed");
                } catch (error) {
                    console.error(`Failed to rename role ${role.id} in guild ${guild.id}:`, error);
                    renameFailed = true;
                }
            }
        } else {
            missing.push(profession);
        }
    }

    return { matched, missing, renameFailed };
}

export async function createMissingRoles(
    guild: Guild,
    missing: CatalogProfession[],
    locale: Locale,
    onRoleCreated?: (professionId: number, roleId: string) => void,
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
        onRoleCreated?.(profession.id, role.id);
    }

    return created;
}
