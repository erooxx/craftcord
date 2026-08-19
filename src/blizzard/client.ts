import "dotenv/config";
import {BLIZZARD_API_HOST, BLIZZARD_NAMESPACE, BLIZZARD_TOKEN_URL} from "./constants";
import {ProfessionIndexResponse, ProfessionSkillTierResponse, RecipeResponse, MediaResponse} from "./types";
import {ProfessionDetailResponse} from "./types";
import {toLocalizedText} from "./localization";
import {EXCLUDED_REAGENT_SLOT_NAMES} from "../catalog/reagentSlots";

export async function getAccessToken(): Promise<string> {
    console.log("[Blizzard] Fetch access token...");

    const tokenRes = await fetch(BLIZZARD_TOKEN_URL, {
        method: "POST",
        headers: {
            Authorization: `Basic ${Buffer.from(`${process.env.BLIZZARD_CLIENT_ID}:${process.env.BLIZZARD_CLIENT_SECRET}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
    });

    if (!tokenRes.ok) {
        const body = await tokenRes.text();
        throw new Error(`Blizzard OAuth token request failed: ${tokenRes.status} ${tokenRes.statusText} — ${body}`);
    }

    const {access_token} = await tokenRes.json();
    console.log("[Blizzard] Access Token fetched.");

    return access_token;
}

async function authenticatedGet<T>(path: string, token: string): Promise<T> {
    console.log(`[Blizzard] GET ${path}`);

    const res = await fetch(`${BLIZZARD_API_HOST}${path}?namespace=${BLIZZARD_NAMESPACE}`, {
            headers: {Authorization: `Bearer ${token}`},
        });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Blizzard API request to ${path} failed: ${res.status} ${res.statusText} - ${body}`);
    }

    return res.json();
}

export async function getProfessionsBasic(token: string) {
    const raw = await authenticatedGet<ProfessionIndexResponse>("/data/wow/profession/index", token);
    return raw.professions.map(p => ({
        id: p.id,
        name: toLocalizedText(p.name),
    }))
}

export async function getProfessionDetails(professionId: number, token: string) {
    const raw = await authenticatedGet<ProfessionDetailResponse>(`/data/wow/profession/${professionId}`, token);
    return raw.skill_tiers.map(tier => ({
        id: tier.id,
        name: toLocalizedText(tier.name),
    }))
}

export async function getProfessionForSkillTier(professionId: number, skillTierId: number, token: string){
    const raw = await authenticatedGet<ProfessionSkillTierResponse>(`/data/wow/profession/${professionId}/skill-tier/${skillTierId}`, token);
    return {
        id: raw.id,
        name: toLocalizedText(raw.name),
        categories: raw.categories.map(category => ({
            name: toLocalizedText(category.name),
            recipes: category.recipes.map(recipe => ({
                id: recipe.id,
                name: toLocalizedText(recipe.name)
            }))
        }))
    }
}

export async function getRecipeIconUrl(recipeId: number, token: string): Promise<string | undefined> {
    const raw = await authenticatedGet<MediaResponse>(`/data/wow/media/recipe/${recipeId}`, token);
    return raw.assets.find(asset => asset.key === "icon")?.value;
}

export async function getRecipeDetails(recipeId: number, token: string) {
    const raw = await authenticatedGet<RecipeResponse>(`/data/wow/recipe/${recipeId}`, token);
    const iconUrl = await getRecipeIconUrl(recipeId, token);

    const fixedReagents = (raw.reagents ?? []).map(r => ({
        id: r.reagent.id,
        name: toLocalizedText(r.reagent.name),
        quantity: r.quantity,
    }));

    const additionalReagents = (raw.modified_crafting_slots ?? [])
        .filter(slot => !EXCLUDED_REAGENT_SLOT_NAMES.has(slot.slot_type.name.en_US))
        .map(slot => ({
            id: slot.slot_type.id,
            name: toLocalizedText(slot.slot_type.name),
        }));

    return {
        id: raw.id,
        name: toLocalizedText(raw.name),
        iconUrl,
        reagents: fixedReagents,
        additionalReagents,
    };
}