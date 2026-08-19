import type { CatalogProfession, CatalogReagent, CatalogAdditionalReagent } from "./recipeCatalog.js";
import type { Locale } from "../guildConfig.js";

export interface RecipeIndexEntry {
    recipeId: number;
    recipeName: Record<Locale, string>;
    professionId: number;
    iconUrl?: string;
    reagents: CatalogReagent[];
    additionalReagents: CatalogAdditionalReagent[];
}

export function buildRecipeIndex(catalog: CatalogProfession[]): RecipeIndexEntry[] {
    const index: RecipeIndexEntry[] = [];

    for (const profession of catalog) {
        for (const category of profession.categories) {
            for (const recipe of category.recipes) {
                index.push({
                    recipeId: recipe.id,
                    recipeName: recipe.name,
                    professionId: profession.id,
                    iconUrl: recipe.iconUrl,
                    reagents: recipe.reagents,
                    additionalReagents: recipe.additionalReagents,
                });
            }
        }
    }

    return index;
}
