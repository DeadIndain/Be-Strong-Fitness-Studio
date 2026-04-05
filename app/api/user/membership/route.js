import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/server";
import { USER_ROLES } from "@/lib/constants/auth";
import {
	MEMBERSHIP_PLANS,
	MEMBERSHIP_STATUS,
	getMembershipPlanById,
} from "@/lib/constants/memberships";
import { adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

const MEMBERSHIP_COLLECTION = "userMemberships";

function membershipDoc(uid) {
	return adminDb.collection(MEMBERSHIP_COLLECTION).doc(uid);
}

function addMonthsIso(isoDate, months) {
	const date = new Date(isoDate);
	const next = new Date(date);
	next.setMonth(next.getMonth() + months);
	return next.toISOString();
}

function getMembershipErrorMessage(error) {
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

	return "Unable to process membership right now.";
}

function sanitizeMembership(data) {
	if (!data) {
		return null;
	}

	return {
		planId: data.planId ?? null,
		planTitle: data.planTitle ?? null,
		durationMonths: data.durationMonths ?? null,
		priceInr: data.priceInr ?? null,
		status: data.status ?? null,
		startedAt: data.startedAt ?? null,
		expiresAt: data.expiresAt ?? null,
		updatedAt: data.updatedAt ?? null,
		createdAt: data.createdAt ?? null,
		source: data.source ?? null,
	};
}

export async function GET() {
	try {
		const session = await getSessionContext();
		if (!session) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		if (session.role !== USER_ROLES.USER) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const snapshot = await membershipDoc(session.uid).get();
		return NextResponse.json({
			membership: sanitizeMembership(snapshot.data()),
			plans: MEMBERSHIP_PLANS,
		});
	} catch (error) {
		console.error("[membership:get]", error);
		return NextResponse.json(
			{ error: getMembershipErrorMessage(error) },
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

		const body = await request.json();
		const planId = String(body?.planId ?? "").trim();
		const plan = getMembershipPlanById(planId);
		if (!plan) {
			return NextResponse.json(
				{ error: "Invalid membership plan." },
				{ status: 400 },
			);
		}

		const now = new Date().toISOString();
		const membership = {
			planId: plan.id,
			planTitle: plan.title,
			durationMonths: plan.durationMonths,
			priceInr: plan.priceInr,
			status: MEMBERSHIP_STATUS.ACTIVE,
			startedAt: now,
			expiresAt: addMonthsIso(now, plan.durationMonths),
			updatedAt: now,
			createdAt: now,
			source: "placeholder-checkout",
		};

		const ref = membershipDoc(session.uid);
		const existing = await ref.get();
		if (existing.exists && existing.data()?.createdAt) {
			membership.createdAt = existing.data().createdAt;
		}

		await ref.set(membership, { merge: true });
		const updated = await ref.get();

		return NextResponse.json({
			membership: sanitizeMembership(updated.data()),
			message: "Membership activated successfully.",
		});
	} catch (error) {
		console.error("[membership:post]", error);
		return NextResponse.json(
			{ error: getMembershipErrorMessage(error) },
			{ status: 500 },
		);
	}
}
