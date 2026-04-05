import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/server";

const PLACEHOLDER_IMAGE = "/images/food-placeholder.svg";

const SYNONYM_MAP = {
	"garbanzo beans": "chickpea",
	garbanzo: "chickpea",
	chana: "chickpea",
	aubergine: "eggplant",
	courgette: "zucchini",
	"lady finger": "okra",
	beetroot: "beet",
	"spring onion": "green onion",
	capsicum: "bell pepper",
};

const DROP_WORDS = new Set([
	"raw",
	"boiled",
	"steamed",
	"fried",
	"grilled",
	"baked",
	"roasted",
	"sauteed",
	"sliced",
	"chopped",
	"fresh",
	"large",
	"small",
	"medium",
	"cup",
	"cups",
	"tbsp",
	"tablespoon",
	"tablespoons",
	"tsp",
	"teaspoon",
	"teaspoons",
	"gram",
	"grams",
	"g",
	"kg",
	"ml",
	"l",
	"oz",
	"ounce",
	"ounces",
	"slice",
	"slices",
	"piece",
	"pieces",
	"serving",
	"servings",
]);

function normalizeFoodName(input) {
	const asText = String(input ?? "").toLowerCase();
	let normalized = asText
		.replace(/[(),]/g, " ")
		.replace(/\b\d+(?:[./]\d+)?\b/g, " ")
		.replace(/\s+/g, " ")
		.trim();

	for (const [from, to] of Object.entries(SYNONYM_MAP)) {
		normalized = normalized.replace(new RegExp(`\\b${from}\\b`, "g"), to);
	}

	normalized = normalized
		.split(" ")
		.filter((word) => word && !DROP_WORDS.has(word))
		.join(" ")
		.trim();

	return normalized || asText.trim();
}

function toNumber(value) {
	const num = Number(value);
	return Number.isFinite(num) ? num : null;
}

function fromOffNutriments(nutriments = {}) {
	const energyKcal =
		toNumber(nutriments["energy-kcal_100g"]) ??
		toNumber(nutriments["energy-kcal_serving"]) ??
		(toNumber(nutriments["energy_100g"]) != null
			? Number((nutriments["energy_100g"] / 4.184).toFixed(1))
			: null);

	return {
		calories: energyKcal,
		protein: toNumber(nutriments.proteins_100g),
		carbs: toNumber(nutriments.carbohydrates_100g),
		fat: toNumber(nutriments.fat_100g),
		fiber: toNumber(nutriments.fiber_100g),
		sugar:
			toNumber(nutriments.sugars_100g) ??
			toNumber(nutriments.sugars_serving) ??
			toNumber(nutriments.sugars),
		sodium: toNumber(nutriments.sodium_100g),
	};
}

async function fetchOpenFoodFacts(query) {
	const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
	url.searchParams.set("search_terms", query);
	url.searchParams.set("search_simple", "1");
	url.searchParams.set("action", "process");
	url.searchParams.set("json", "1");
	url.searchParams.set("page_size", "12");

	const response = await fetch(url, { cache: "no-store" });
	if (!response.ok) {
		return null;
	}

	const data = await response.json();
	const products = Array.isArray(data?.products) ? data.products : [];
	const product =
		products.find((entry) => entry?.nutriments) ?? products[0] ?? null;

	if (!product) {
		return null;
	}

	const name = product.product_name || product.product_name_en || query;
	const nutrients = fromOffNutriments(product.nutriments ?? {});

	return {
		source: "Open Food Facts",
		nutritionSourceType: "packaged",
		name,
		canonicalName: normalizeFoodName(name),
		servingBasis: "Per 100g",
		image:
			product.image_front_url ||
			product.image_front_small_url ||
			product.image_url ||
			null,
		nutrients,
		isPackaged: Boolean(product.code || product.brands || product.packaging),
		raw: {
			brand: product.brands || null,
			code: product.code || null,
		},
	};
}

function nutrientValue(foodNutrients, names = [], nutrientNumbers = []) {
	for (const nutrient of foodNutrients) {
		const nutrientName = nutrient?.nutrientName;
		const nutrientNumber = String(nutrient?.nutrientNumber ?? "");

		if (
			names.includes(nutrientName) ||
			nutrientNumbers.includes(nutrientNumber)
		) {
			const value = toNumber(nutrient.value);
			if (value != null) {
				return value;
			}
		}
	}

	return null;
}

async function fetchUsdaFood(query) {
	const apiKey = process.env.USDA_API_KEY || "DEMO_KEY";
	const endpoint = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`;

	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		cache: "no-store",
		body: JSON.stringify({
			query,
			pageSize: 8,
			sortBy: "dataType.keyword",
			sortOrder: "asc",
		}),
	});

	if (!response.ok) {
		return null;
	}

	const data = await response.json();
	const foods = Array.isArray(data?.foods) ? data.foods : [];
	const food = foods[0] ?? null;

	if (!food) {
		return null;
	}

	const nutrientsSource = Array.isArray(food.foodNutrients)
		? food.foodNutrients
		: [];
	const calories =
		nutrientValue(nutrientsSource, ["Energy"]) ??
		nutrientValue(nutrientsSource, ["Energy (Atwater General Factors)"]);

	const servingBasis =
		food.servingSize && food.servingSizeUnit
			? `Per ${food.servingSize} ${food.servingSizeUnit}`
			: "Per 100g";

	return {
		source: "USDA FoodData Central",
		nutritionSourceType: "natural-food",
		name: food.description || query,
		canonicalName: normalizeFoodName(food.description || query),
		servingBasis,
		image: null,
		nutrients: {
			calories,
			protein: nutrientValue(nutrientsSource, ["Protein"]),
			carbs: nutrientValue(nutrientsSource, ["Carbohydrate, by difference"]),
			fat: nutrientValue(nutrientsSource, ["Total lipid (fat)"]),
			fiber: nutrientValue(nutrientsSource, ["Fiber, total dietary"]),
			sugar: nutrientValue(
				nutrientsSource,
				["Sugars, total including NLEA", "Total Sugars", "Sugars, total"],
				["269"],
			),
			sodium: nutrientValue(nutrientsSource, ["Sodium, Na"]),
		},
		raw: {
			fdcId: food.fdcId ?? null,
			dataType: food.dataType ?? null,
		},
	};
}

function hasCoreNutrition(item) {
	if (!item) {
		return false;
	}

	const nutrients = item.nutrients ?? {};
	return [
		nutrients.calories,
		nutrients.protein,
		nutrients.carbs,
		nutrients.fat,
	].some((value) => value != null);
}

function pickBestNutrition(openFoodFactsFood, usdaFood) {
	if (openFoodFactsFood?.isPackaged && hasCoreNutrition(openFoodFactsFood)) {
		return openFoodFactsFood;
	}

	if (usdaFood && hasCoreNutrition(usdaFood)) {
		return usdaFood;
	}

	if (hasCoreNutrition(openFoodFactsFood)) {
		return openFoodFactsFood;
	}

	return usdaFood || openFoodFactsFood || null;
}

function getFirstPageImage(pages) {
	const firstPage = Object.values(pages ?? {})[0];
	const imageInfo = firstPage?.imageinfo?.[0];
	return imageInfo?.thumburl || imageInfo?.url || null;
}

async function fetchWikimediaImage(term) {
	const url = new URL("https://commons.wikimedia.org/w/api.php");
	url.searchParams.set("action", "query");
	url.searchParams.set("generator", "search");
	url.searchParams.set("gsrsearch", `${term} food`);
	url.searchParams.set("gsrnamespace", "6");
	url.searchParams.set("gsrlimit", "1");
	url.searchParams.set("prop", "imageinfo");
	url.searchParams.set("iiprop", "url");
	url.searchParams.set("iiurlwidth", "900");
	url.searchParams.set("format", "json");
	url.searchParams.set("origin", "*");

	const response = await fetch(url, { cache: "no-store" });
	if (!response.ok) {
		return null;
	}

	const data = await response.json();
	return getFirstPageImage(data?.query?.pages ?? null);
}

async function fetchPexelsImage(term) {
	const apiKey = process.env.PEXELS_API_KEY;
	if (!apiKey) {
		return null;
	}

	const url = new URL("https://api.pexels.com/v1/search");
	url.searchParams.set("query", `${term} food plain background`);
	url.searchParams.set("per_page", "1");
	url.searchParams.set("orientation", "square");

	const response = await fetch(url, {
		headers: {
			Authorization: apiKey,
		},
		cache: "no-store",
	});

	if (!response.ok) {
		return null;
	}

	const data = await response.json();
	const firstPhoto = Array.isArray(data?.photos) ? data.photos[0] : null;
	return firstPhoto?.src?.large || firstPhoto?.src?.medium || null;
}

async function fetchUnsplashImage(term) {
	const apiKey = process.env.UNSPLASH_ACCESS_KEY;
	if (!apiKey) {
		return `https://source.unsplash.com/featured/?${encodeURIComponent(`${term},food,plain background`)}`;
	}

	const url = new URL("https://api.unsplash.com/search/photos");
	url.searchParams.set("query", `${term} food plain background`);
	url.searchParams.set("per_page", "1");
	url.searchParams.set("orientation", "squarish");
	url.searchParams.set("client_id", apiKey);

	const response = await fetch(url, { cache: "no-store" });
	if (!response.ok) {
		return null;
	}

	const data = await response.json();
	const first = Array.isArray(data?.results) ? data.results[0] : null;
	return first?.urls?.regular || first?.urls?.small || null;
}

async function resolveFoodImage(item) {
	if (item?.image) {
		return {
			url: item.image,
			source: item.source,
		};
	}

	const queryTerm = item?.canonicalName || item?.name || "healthy food";
	const wikimediaImage = await fetchWikimediaImage(queryTerm);
	if (wikimediaImage) {
		return {
			url: wikimediaImage,
			source: "Wikimedia Commons",
		};
	}

	const pexelsImage = await fetchPexelsImage(queryTerm);
	if (pexelsImage) {
		return {
			url: pexelsImage,
			source: "Pexels",
		};
	}

	const unsplashImage = await fetchUnsplashImage(queryTerm);
	if (unsplashImage) {
		return {
			url: unsplashImage,
			source: "Unsplash",
		};
	}

	return {
		url: PLACEHOLDER_IMAGE,
		source: "Placeholder",
	};
}

function withRoundedNutrients(item) {
	const roundedNutrients = Object.fromEntries(
		Object.entries(item.nutrients ?? {}).map(([key, value]) => [
			key,
			value == null ? null : Number(value.toFixed(1)),
		]),
	);

	return {
		...item,
		nutrients: roundedNutrients,
	};
}

export async function GET(request) {
	const session = await getSessionContext();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const query = request.nextUrl.searchParams.get("q")?.trim() || "";
	if (query.length < 2) {
		return NextResponse.json(
			{ error: "Please enter at least 2 characters." },
			{ status: 400 },
		);
	}

	try {
		const normalizedQuery = normalizeFoodName(query);
		const [openFoodFactsFood, usdaFood] = await Promise.all([
			fetchOpenFoodFacts(query),
			fetchUsdaFood(normalizedQuery),
		]);

		const best = pickBestNutrition(openFoodFactsFood, usdaFood);
		if (!best) {
			return NextResponse.json(
				{ error: "No nutrition match found for this food." },
				{ status: 404 },
			);
		}

		const image = await resolveFoodImage(best);
		const result = withRoundedNutrients(best);

		return NextResponse.json({
			query,
			normalizedQuery,
			item: {
				...result,
				image: image.url,
				imageSource: image.source,
			},
		});
	} catch {
		return NextResponse.json(
			{ error: "Unable to fetch food nutrition right now." },
			{ status: 500 },
		);
	}
}
