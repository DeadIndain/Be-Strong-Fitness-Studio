import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/server";
import { USER_ROLES } from "@/lib/constants/auth";
import { adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

const PROFILE_COLLECTION = "userFitnessProfiles";

const GOAL_LIBRARY = [
	{
		id: "fat-loss",
		title: "Lose Fat",
		description: "Focus on sustainable fat loss while preserving muscle.",
	},
	{
		id: "muscle-gain",
		title: "Build Muscle",
		description: "Progressive overload training and high-protein nutrition.",
	},
	{
		id: "recomp",
		title: "Body Recomposition",
		description: "Lose fat and gain strength with balanced calories.",
	},
	{
		id: "endurance",
		title: "Improve Endurance",
		description: "Cardio capacity, recovery, and consistent fueling.",
	},
];

const ACTIVITY_MULTIPLIERS = {
	sedentary: 1.2,
	light: 1.375,
	moderate: 1.55,
	active: 1.725,
	very_active: 1.9,
};

function profileRef(uid) {
	return adminDb.collection(PROFILE_COLLECTION).doc(uid);
}

function toNumber(value) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		return null;
	}
	return parsed;
}

function sanitizeProfile(raw) {
	const age = Math.round(toNumber(raw?.age));
	const heightCm = toNumber(raw?.heightCm);
	const weightKg = toNumber(raw?.weightKg);
	const gender = String(raw?.gender ?? "unspecified").toLowerCase();
	const activityLevel = String(raw?.activityLevel ?? "moderate");
	const trainingDays = Math.round(toNumber(raw?.trainingDays) ?? 3);
	const dietaryPreference = String(raw?.dietaryPreference ?? "none").trim();

	if (!age || age < 12 || age > 100) {
		return { error: "Age must be between 12 and 100." };
	}

	if (!heightCm || heightCm < 120 || heightCm > 230) {
		return { error: "Height must be between 120cm and 230cm." };
	}

	if (!weightKg || weightKg < 30 || weightKg > 300) {
		return { error: "Weight must be between 30kg and 300kg." };
	}

	if (
		!Object.prototype.hasOwnProperty.call(ACTIVITY_MULTIPLIERS, activityLevel)
	) {
		return { error: "Invalid activity level." };
	}

	return {
		profile: {
			age,
			heightCm,
			weightKg,
			gender,
			activityLevel,
			trainingDays: Math.min(Math.max(trainingDays, 1), 7),
			dietaryPreference: dietaryPreference || "none",
		},
	};
}

function round(value, precision = 0) {
	const scale = 10 ** precision;
	return Math.round(value * scale) / scale;
}

function calculateBmi(profile) {
	const hMeters = profile.heightCm / 100;
	return round(profile.weightKg / (hMeters * hMeters), 1);
}

function calculateMaintenanceCalories(profile) {
	const baseBmr =
		profile.gender === "female"
			? 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age - 161
			: 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + 5;
	const multiplier = ACTIVITY_MULTIPLIERS[profile.activityLevel] ?? 1.55;
	return Math.round(baseBmr * multiplier);
}

function planCaloriesForGoal(maintenanceCalories, goalId) {
	switch (goalId) {
		case "fat-loss":
			return maintenanceCalories - 350;
		case "muscle-gain":
			return maintenanceCalories + 250;
		case "endurance":
			return maintenanceCalories + 100;
		default:
			return maintenanceCalories;
	}
}

function macroPlan(profile, calories, goalId) {
	const proteinPerKg =
		goalId === "muscle-gain" ? 2 : goalId === "fat-loss" ? 1.9 : 1.7;
	const protein = Math.round(profile.weightKg * proteinPerKg);
	const fat = Math.round((calories * 0.27) / 9);
	const carbs = Math.max(
		Math.round((calories - protein * 4 - fat * 9) / 4),
		80,
	);
	return { protein, carbs, fat };
}

function goalSuggestions(profile) {
	const bmi = calculateBmi(profile);
	const recommendedGoalId =
		bmi >= 27 ? "fat-loss" : bmi <= 21 ? "muscle-gain" : "recomp";

	return GOAL_LIBRARY.map((goal) => ({
		...goal,
		recommended: goal.id === recommendedGoalId,
	}));
}

function buildPlan(profile, goalId) {
	const goal = GOAL_LIBRARY.find((item) => item.id === goalId);
	if (!goal) {
		return null;
	}

	const maintenanceCalories = calculateMaintenanceCalories(profile);
	const dailyCalories = Math.max(
		planCaloriesForGoal(maintenanceCalories, goalId),
		1200,
	);
	const macros = macroPlan(profile, dailyCalories, goalId);

	const mealTemplateByGoal = {
		"fat-loss": [
			"Breakfast: Eggs or Greek yogurt + fruit",
			"Lunch: Lean protein bowl with vegetables",
			"Snack: Whey shake or sprouts salad",
			"Dinner: Grilled fish/chicken + mixed veggies",
		],
		"muscle-gain": [
			"Breakfast: Oats + milk + banana + nuts",
			"Lunch: Rice + chicken/paneer + vegetables",
			"Snack: Protein smoothie + peanut butter toast",
			"Dinner: Potatoes/rice + lean protein + salad",
		],
		recomp: [
			"Breakfast: High-protein omelet + toast",
			"Lunch: Balanced plate with protein, carbs, and greens",
			"Snack: Cottage cheese or yogurt + seeds",
			"Dinner: Lean protein + moderate carbs + veggies",
		],
		endurance: [
			"Breakfast: Oats + fruit + yogurt",
			"Lunch: Rice/pasta + lean protein + vegetables",
			"Pre-workout: Banana + toast",
			"Dinner: Protein + complex carbs + salad",
		],
	};

	const workoutsByGoal = {
		"fat-loss": [
			"3 days full-body strength training",
			"2 days interval cardio (20-30 min)",
			"Daily 8,000-10,000 steps",
		],
		"muscle-gain": [
			"4-5 days resistance training (upper/lower split)",
			"Progressive overload each week",
			"1-2 light cardio sessions for recovery",
		],
		recomp: [
			"4 days resistance training",
			"2 short cardio sessions",
			"Track lifts and maintain effort in compound movements",
		],
		endurance: [
			"3 cardio sessions (zone 2 + intervals)",
			"2-3 strength sessions to support performance",
			"1 mobility/recovery day",
		],
	};

	return {
		goalId: goal.id,
		goalTitle: goal.title,
		overview: goal.description,
		dailyCalories,
		maintenanceCalories,
		dailyMacros: macros,
		nutritionPlan: mealTemplateByGoal[goal.id] ?? [],
		trainingPlan: workoutsByGoal[goal.id] ?? [],
		habits: [
			"Drink at least 2.5L water daily",
			"Sleep 7-9 hours each night",
			"Track body weight 2-3 times per week",
		],
		durationWeeks: 8,
	};
}

function cleanDocument(data) {
	if (!data) {
		return null;
	}

	return {
		profile: data.profile ?? null,
		selectedGoal: data.selectedGoal ?? null,
		plan: data.plan ?? null,
		goals: data.profile ? goalSuggestions(data.profile) : [],
		updatedAt: data.updatedAt ?? null,
		createdAt: data.createdAt ?? null,
	};
}

function getPlannerErrorMessage(error) {
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

	return "Unable to process your goal planner request right now.";
}

async function requireUserSession() {
	const session = await getSessionContext();
	if (!session) {
		return {
			error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
		};
	}

	if (session.role !== USER_ROLES.USER) {
		return {
			error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
		};
	}

	return { session };
}

export async function GET() {
	try {
		const { session, error } = await requireUserSession();
		if (error) {
			return error;
		}

		const snapshot = await profileRef(session.uid).get();
		if (!snapshot.exists) {
			return NextResponse.json({
				profile: null,
				goals: [],
				selectedGoal: null,
				plan: null,
			});
		}

		return NextResponse.json(cleanDocument(snapshot.data()));
	} catch (error) {
		console.error("[planner:get]", error);
		return NextResponse.json(
			{ error: getPlannerErrorMessage(error) },
			{ status: 500 },
		);
	}
}

export async function PUT(request) {
	try {
		const { session, error } = await requireUserSession();
		if (error) {
			return error;
		}

		const payload = await request.json();
		const parsed = sanitizeProfile(payload?.profile);
		if (parsed.error) {
			return NextResponse.json({ error: parsed.error }, { status: 400 });
		}

		const now = new Date().toISOString();
		const ref = profileRef(session.uid);
		const existing = await ref.get();

		await ref.set(
			{
				profile: parsed.profile,
				goals: goalSuggestions(parsed.profile),
				updatedAt: now,
				createdAt: existing.exists ? (existing.data()?.createdAt ?? now) : now,
			},
			{ merge: true },
		);

		const updated = await ref.get();
		return NextResponse.json(cleanDocument(updated.data()));
	} catch (error) {
		console.error("[planner:put]", error);
		return NextResponse.json(
			{ error: getPlannerErrorMessage(error) },
			{ status: 500 },
		);
	}
}

export async function POST(request) {
	try {
		const { session, error } = await requireUserSession();
		if (error) {
			return error;
		}

		const payload = await request.json();
		const goalId = String(payload?.goalId ?? "").trim();

		const ref = profileRef(session.uid);
		const snapshot = await ref.get();
		if (!snapshot.exists || !snapshot.data()?.profile) {
			return NextResponse.json(
				{ error: "Please save your details first." },
				{ status: 400 },
			);
		}

		const data = snapshot.data();
		const plan = buildPlan(data.profile, goalId);
		if (!plan) {
			return NextResponse.json(
				{ error: "Invalid goal selected." },
				{ status: 400 },
			);
		}

		const now = new Date().toISOString();
		await ref.set(
			{
				selectedGoal: goalId,
				plan,
				updatedAt: now,
			},
			{ merge: true },
		);

		const updated = await ref.get();
		return NextResponse.json(cleanDocument(updated.data()));
	} catch (error) {
		console.error("[planner:post]", error);
		return NextResponse.json(
			{ error: getPlannerErrorMessage(error) },
			{ status: 500 },
		);
	}
}
