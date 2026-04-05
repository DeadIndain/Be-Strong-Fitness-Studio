import { getSessionContext } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || "exercisedb.p.rapidapi.com";
const RAPIDAPI_KEY = process.env.RAPIDAPI_EXERCISEDB_KEY || "";

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

function normalizeResolution(value) {
	const parsed = Number.parseInt(String(value ?? "360"), 10);
	if (!Number.isFinite(parsed)) {
		return 360;
	}

	if (parsed <= 180) {
		return 180;
	}

	if (parsed <= 360) {
		return 360;
	}

	return 720;
}

export async function GET(request) {
	const session = await getSessionContext();
	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	if (!RAPIDAPI_KEY) {
		return new Response("RAPIDAPI_EXERCISEDB_KEY is missing.", { status: 500 });
	}

	const exerciseId = normalizeExerciseId(
		request.nextUrl.searchParams.get("exerciseId"),
	);
	const resolution = normalizeResolution(
		request.nextUrl.searchParams.get("resolution"),
	);

	if (!exerciseId) {
		return new Response("exerciseId is required.", { status: 400 });
	}

	const url = new URL(`https://${RAPIDAPI_HOST}/image`);
	url.searchParams.set("exerciseId", exerciseId);
	url.searchParams.set("resolution", String(resolution));

	try {
		const upstream = await fetch(url, {
			method: "GET",
			headers: {
				"X-RapidAPI-Key": RAPIDAPI_KEY,
				"X-RapidAPI-Host": RAPIDAPI_HOST,
			},
			cache: "no-store",
		});

		if (!upstream.ok) {
			return new Response("Image unavailable.", { status: upstream.status });
		}

		const contentType = upstream.headers.get("content-type") || "image/gif";
		const imageBuffer = await upstream.arrayBuffer();

		return new Response(imageBuffer, {
			status: 200,
			headers: {
				"Content-Type": contentType,
				"Cache-Control": "private, no-store",
			},
		});
	} catch {
		return new Response("Unable to load image.", { status: 500 });
	}
}
