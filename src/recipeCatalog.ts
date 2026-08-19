import { readFileSync } from "node:fs";
import type { Locale } from "./guildConfig.js";

export interface CatalogReagent {
    id: number;
    name: Record<Locale, string>;
    quantity: number;
}

export interface CatalogAdditionalReagent {
    id: number;
    name: Record<Locale, string>;
}

export interface CatalogRecipe {
    id: number;
    name: Record<Locale, string>;
    iconUrl?: string;
    reagents: CatalogReagent[];
    additionalReagents: CatalogAdditionalReagent[];
}

export interface CatalogCategory {
    name: Record<Locale, string>;
    recipes: CatalogRecipe[];
}

export interface CatalogProfession {
    id: number;
    name: Record<Locale, string>;
    categories: CatalogCategory[];
}

export function loadRecipeCatalog(): CatalogProfession[] {
    const raw = readFileSync("data/recipes.json", "utf-8");
    return JSON.parse(raw);
}
