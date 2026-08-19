import { getAccessToken, getProfessionDetails, getProfessionForSkillTier, getProfessionsBasic, getRecipeDetails } from "../blizzard/client.js";
import { RELEVANT_PROFESSION_IDS } from "../professions.js";
import { isExcludedCategory } from "../excludedCategories.js";
import { writeFileSync, mkdirSync } from "node:fs";

function getCurrentSkillTier(skillTiers: { id: number; name: { de: string; en: string } }[]) {
    return skillTiers.reduce((newest, tier) => (tier.id > newest.id ? tier : newest));
}

const token = await getAccessToken();
const professions = await getProfessionsBasic(token);
const relevantProfessions = professions.filter(p => RELEVANT_PROFESSION_IDS.has(p.id));

const catalog = [];

for (const profession of relevantProfessions) {
    const skillTiers = await getProfessionDetails(profession.id, token);
    const currentTier = getCurrentSkillTier(skillTiers);
    const tierDetails = await getProfessionForSkillTier(profession.id, currentTier.id, token);

    const categories = [];
    for (const category of tierDetails.categories) {
        if (isExcludedCategory(category.name.en)) {
            continue;
        }

        const recipes = [];
        for (const recipe of category.recipes) {
            try {
                recipes.push(await getRecipeDetails(recipe.id, token));
            } catch (err) {
                console.error(`Recipe ${recipe.id} skipped: ${err}`);
            }
        }
        categories.push({ name: category.name, recipes });
    }

    catalog.push({ id: profession.id, name: profession.name, skillTier: currentTier, categories });
    console.log(`Done: ${profession.name.de}`);
}

mkdirSync("data", { recursive: true });
writeFileSync("data/recipes.json", JSON.stringify(catalog, null, 2));
console.log(`Import completed: ${catalog.length} professions.`);