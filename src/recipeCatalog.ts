import { readFileSync } from "node:fs";
import type { Locale } from "./guildConfig.js";

export interface CatalogProfession {
    id: number;
    name: Record<Locale, string>;
}

export function loadRecipeCatalog(): CatalogProfession[] {
    const raw = readFileSync("data/recipes.json", "utf-8");
    return JSON.parse(raw);
}
