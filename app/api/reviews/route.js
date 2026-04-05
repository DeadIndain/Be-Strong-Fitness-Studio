import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/server";
import { USER_ROLES } from "@/lib/constants/auth";
import { adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

const REVIEWS_COLLECTION = "gymReviews";
const MAX_COMMENT_LENGTH = 280;
const MAX_RESULTS = 20;

function reviewsRef() {
	return adminDb.collection(REVIEWS_COLLECTION);
}

function getReviewsErrorMessage(error) {
	const code = Number(error?.code);
	const message = String(error?.message ?? "");

	if (code === 5 || message.includes("NOT_FOUND")) {
		return "Firestore database was not found for this project. Create a Firestore database in Firebase Console and try again.";
	}

	if (code === 7 || message.includes("PERMISSION_DENIED")) {
		return "Firestore permission denied for the server service account. Ensure the Firebase Admin SDK service account has Firestore access.";
	}

	if (code === 16 || message.includes("UNAUTHENTICATED")) {
		return "Firebase Admin credentials are invalid or expired. Update FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.";
	}

	return "Unable to process reviews right now.";
}

function toRating(value) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		return null;
	}
	return Math.round(parsed);
}

function sanitizeComment(value) {
	return String(value ?? "")
		.replace(/\s+/g, " ")
		.trim();
}

function displayNameFromSession(session) {
	const fromName = String(session?.displayName ?? "").trim();
	if (fromName) {
		return fromName.slice(0, 60);
	}

	const email = String(session?.email ?? "").trim();
	if (!email) {
		return "Member";
	}

	return email.split("@")[0].slice(0, 60) || "Member";
}

function mapReview(doc) {
	const data = doc.data() ?? {};
	return {
		id: doc.id,
		rating: data.rating ?? 0,
		comment: data.comment ?? "",
		authorName: data.authorName ?? "Member",
		createdAt: data.createdAt ?? null,
	};
}

export async function GET() {
	try {
		const snapshot = await reviewsRef()
			.orderBy("createdAt", "desc")
			.limit(MAX_RESULTS)
			.get();

		const reviews = snapshot.docs.map(mapReview);
		return NextResponse.json({ reviews });
	} catch (error) {
		console.error("[reviews:get]", error);
		return NextResponse.json(
			{ error: getReviewsErrorMessage(error) },
			{ status: 500 },
		);
	}
}

export async function POST(request) {
	try {
		const session = await getSessionContext();
		if (!session) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		if (session.role !== USER_ROLES.USER) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const payload = await request.json();
		const rating = toRating(payload?.rating);
		const comment = sanitizeComment(payload?.comment);

		if (!rating || rating < 1 || rating > 5) {
			return NextResponse.json(
				{ error: "Rating must be between 1 and 5." },
				{ status: 400 },
			);
		}

		if (comment.length < 8) {
			return NextResponse.json(
				{ error: "Please write at least 8 characters." },
				{ status: 400 },
			);
		}

		if (comment.length > MAX_COMMENT_LENGTH) {
			return NextResponse.json(
				{ error: `Review must be ${MAX_COMMENT_LENGTH} characters or less.` },
				{ status: 400 },
			);
		}

		const createdAt = new Date().toISOString();
		const docRef = await reviewsRef().add({
			uid: session.uid,
			authorName: displayNameFromSession(session),
			rating,
			comment,
			createdAt,
		});
		const saved = await docRef.get();

		return NextResponse.json({ review: mapReview(saved) }, { status: 201 });
	} catch (error) {
		console.error("[reviews:post]", error);
		return NextResponse.json(
			{ error: getReviewsErrorMessage(error) },
			{ status: 500 },
		);
	}
}
