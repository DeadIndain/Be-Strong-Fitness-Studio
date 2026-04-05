import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/server";
import { USER_ROLES } from "@/lib/constants/auth";
import {
	ALLOWED_MEMBERSHIP_STATUS,
	MEMBERSHIP_PLANS,
	getMembershipPlanById,
} from "@/lib/constants/memberships";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

const MEMBERSHIP_COLLECTION = "userMemberships";

function membershipsCollection() {
	return adminDb.collection(MEMBERSHIP_COLLECTION);
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

	return "Unable to process membership management right now.";
}

async function requireStaff() {
	const session = await getSessionContext();
	if (!session) {
		return {
			error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
		};
	}

	if (session.role !== USER_ROLES.STAFF) {
		return {
			error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
		};
	}

	return { session };
}

function mergeUserWithMembership(userRecord, membership) {
	return {
		uid: userRecord.uid,
		email: userRecord.email ?? null,
		displayName: userRecord.displayName ?? null,
		role:
			userRecord.customClaims?.role === USER_ROLES.STAFF
				? USER_ROLES.STAFF
				: USER_ROLES.USER,
		membership: membership
			? {
					planId: membership.planId ?? null,
					planTitle: membership.planTitle ?? null,
					durationMonths: membership.durationMonths ?? null,
					priceInr: membership.priceInr ?? null,
					status: membership.status ?? null,
					startedAt: membership.startedAt ?? null,
					expiresAt: membership.expiresAt ?? null,
					updatedAt: membership.updatedAt ?? null,
				}
			: null,
	};
}

async function loadMembershipMap() {
	const snapshot = await membershipsCollection().get();
	const byUid = new Map();
	snapshot.forEach((doc) => {
		byUid.set(doc.id, doc.data());
	});
	return byUid;
}

export async function GET() {
	try {
		const authResult = await requireStaff();
		if (authResult.error) {
			return authResult.error;
		}

		const usersResult = await adminAuth.listUsers(1000);
		const membershipsByUid = await loadMembershipMap();

		const users = usersResult.users.map((userRecord) =>
			mergeUserWithMembership(userRecord, membershipsByUid.get(userRecord.uid)),
		);

		return NextResponse.json({
			users,
			plans: MEMBERSHIP_PLANS,
			allowedStatus: Array.from(ALLOWED_MEMBERSHIP_STATUS),
		});
	} catch (error) {
		console.error("[staff-memberships:get]", error);
		return NextResponse.json(
			{ error: getMembershipErrorMessage(error) },
			{ status: 500 },
		);
	}
}

export async function PATCH(request) {
	try {
		const authResult = await requireStaff();
		if (authResult.error) {
			return authResult.error;
		}

		const body = await request.json();
		const uid = String(body?.uid ?? "").trim();
		const planId = String(body?.planId ?? "").trim();
		const status = String(body?.status ?? "").trim();

		if (!uid) {
			return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
		}

		if (!status || !ALLOWED_MEMBERSHIP_STATUS.has(status)) {
			return NextResponse.json(
				{ error: "Invalid membership status." },
				{ status: 400 },
			);
		}

		const plan = planId ? getMembershipPlanById(planId) : null;
		if (planId && !plan) {
			return NextResponse.json(
				{ error: "Invalid plan selected." },
				{ status: 400 },
			);
		}

		const now = new Date().toISOString();
		const ref = membershipsCollection().doc(uid);
		const existing = await ref.get();
		const previous = existing.data() ?? {};

		const nextPlanId = plan?.id ?? previous.planId ?? null;
		const nextPlan = nextPlanId ? getMembershipPlanById(nextPlanId) : null;
		const nextStartedAt = plan ? now : (previous.startedAt ?? now);
		const nextDurationMonths =
			nextPlan?.durationMonths ?? previous.durationMonths ?? null;

		const nextMembership = {
			planId: nextPlan?.id ?? null,
			planTitle: nextPlan?.title ?? previous.planTitle ?? null,
			durationMonths: nextDurationMonths,
			priceInr: nextPlan?.priceInr ?? previous.priceInr ?? null,
			status,
			startedAt: nextStartedAt,
			expiresAt:
				nextDurationMonths && nextStartedAt
					? addMonthsIso(nextStartedAt, nextDurationMonths)
					: (previous.expiresAt ?? null),
			updatedAt: now,
			createdAt: previous.createdAt ?? now,
			source: previous.source ?? "admin-managed",
		};

		await ref.set(nextMembership, { merge: true });

		return NextResponse.json({ ok: true, membership: nextMembership });
	} catch (error) {
		console.error("[staff-memberships:patch]", error);
		return NextResponse.json(
			{ error: getMembershipErrorMessage(error) },
			{ status: 500 },
		);
	}
}
