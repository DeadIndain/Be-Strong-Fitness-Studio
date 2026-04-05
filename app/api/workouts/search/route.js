import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || "exercisedb.p.rapidapi.com";
const RAPIDAPI_KEY = process.env.RAPIDAPI_EXERCISEDB_KEY || "";
const MAX_RESULTS = 6;

const BODY_PART_ALIASES = new Map([
	["chest", "chest"],
	["back", "back"],
	["shoulder", "shoulders"],
	["shoulders", "shoulders"],
	["upper arm", "upper arms"],
	["upper arms", "upper arms"],
	["arm", "upper arms"],
	["arms", "upper arms"],
	["leg", "upper legs"],
	["legs", "upper legs"],
	["upper leg", "upper legs"],
	["upper legs", "upper legs"],
	["lower leg", "lower legs"],
	["lower legs", "lower legs"],
	["waist", "waist"],
	["abs", "waist"],
	["core", "waist"],
	["cardio", "cardio"],
]);

const TARGET_ALIASES = new Map([
	["biceps", "biceps"],
	["triceps", "triceps"],
	["glutes", "glutes"],
	["glute", "glutes"],
	["quads", "quads"],
	["quadriceps", "quads"],
	["hamstrings", "hamstrings"],
	["calves", "calves"],
	["lats", "lats"],
	["traps", "traps"],
	["delts", "delts"],
	["forearms", "forearms"],
	["pectorals", "pectorals"],
	["abs", "abs"],
	["abdominals", "abs"],
]);

function normalizeQuery(value) {
	return String(value ?? "")
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function pickEndpoint(query, mode) {
	const normalized = normalizeQuery(query);
	const explicitMode = normalizeQuery(mode);

	if (explicitMode === "body part" || explicitMode === "bodypart") {
		return {
			type: "bodyPart",
			value: BODY_PART_ALIASES.get(normalized) || normalized,
		};
	}

	if (explicitMode === "target") {
		return {
			type: "target",
			value: TARGET_ALIASES.get(normalized) || normalized,
		};
	}

	if (explicitMode === "name") {
		return { type: "name", value: normalized };
	}

	if (BODY_PART_ALIASES.has(normalized)) {
		return { type: "bodyPart", value: BODY_PART_ALIASES.get(normalized) };
	}

	if (TARGET_ALIASES.has(normalized)) {
		return { type: "target", value: TARGET_ALIASES.get(normalized) };
	}

	return { type: "name", value: normalized };
}

function toArray(value) {
	if (Array.isArray(value)) {
		return value;
	}

	if (value == null) {
		return [];
	}

	return [value];
}

function normalizeExerciseId(value) {
	const raw = String(value ?? "").trim();
	if (!raw) {
		return null;
	}

	if (/^\d{1,4}$/.test(raw)) {
		return raw.padStart(4, "0");
	}

	return raw;
}

function buildProxyGifUrl(exerciseId) {
	const normalized = normalizeExerciseId(exerciseId);
	if (!normalized) {
		return null;
	}

	return `/api/workouts/image?exerciseId=${encodeURIComponent(normalized)}&resolution=360`;
}

function mapExercise(exercise) {
	return {
		id: exercise?.id,
		name: exercise?.name || "Exercise",
		bodyPart: exercise?.bodyPart || "General",
		target: exercise?.target || "General",
		equipment: exercise?.equipment || "Bodyweight",
		gifUrl: exercise?.gifUrl || buildProxyGifUrl(exercise?.id),
		secondaryMuscles: toArray(exercise?.secondaryMuscles).filter(Boolean),
		instructions: toArray(exercise?.instructions).filter(Boolean),
	};
}

export async function GET(request) {
	const session = await getSessionContext();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!RAPIDAPI_KEY) {
		return NextResponse.json(
			{ error: "RAPIDAPI_EXERCISEDB_KEY is missing." },
			{ status: 500 },
		);
	}

	const q = request.nextUrl.searchParams.get("q")?.trim() || "";
	const mode = request.nextUrl.searchParams.get("mode")?.trim() || "auto";

	if (q.length < 2) {
		return NextResponse.json(
			{ error: "Please enter at least 2 characters." },
			{ status: 400 },
		);
	}

	try {
		const endpoint = pickEndpoint(q, mode);
		const url = new URL(
			`https://${RAPIDAPI_HOST}/exercises/${endpoint.type}/${encodeURIComponent(endpoint.value)}`,
		);
		const response = await fetch(url, {
			method: "GET",
			headers: {
				"X-RapidAPI-Key": RAPIDAPI_KEY,
				"X-RapidAPI-Host": RAPIDAPI_HOST,
			},
			cache: "no-store",
		});

		if (response.status === 404) {
			return NextResponse.json({
				query: q,
				mode: endpoint.type,
				exercises: [],
			});
		}

		if (!response.ok) {
			return NextResponse.json(
				{ error: "ExerciseDB request failed." },
				{ status: 502 },
			);
		}

		const data = await response.json();
		const exercises = Array.isArray(data) ? data : [];

		return NextResponse.json({
			query: q,
			mode: endpoint.type,
			exercises: exercises.slice(0, MAX_RESULTS).map(mapExercise),
		});
	} catch {
		return NextResponse.json(
			{ error: "Unable to fetch workouts right now." },
			{ status: 500 },
		);
	}
}
