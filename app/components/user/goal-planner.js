"use client";

import { useEffect, useMemo, useState } from "react";

const INITIAL_PROFILE = {
	age: "",
	heightCm: "",
	weightKg: "",
	gender: "unspecified",
	activityLevel: "moderate",
	trainingDays: "4",
	dietaryPreference: "none",
};

const ACTIVITY_LEVELS = [
	{ value: "sedentary", label: "Sedentary" },
	{ value: "light", label: "Lightly active" },
	{ value: "moderate", label: "Moderately active" },
	{ value: "active", label: "Active" },
	{ value: "very_active", label: "Very active" },
];

const GENDERS = [
	{ value: "unspecified", label: "Prefer not to say" },
	{ value: "male", label: "Male" },
	{ value: "female", label: "Female" },
];

function profileFromApi(profile) {
	if (!profile) {
		return INITIAL_PROFILE;
	}

	return {
		age: String(profile.age ?? ""),
		heightCm: String(profile.heightCm ?? ""),
		weightKg: String(profile.weightKg ?? ""),
		gender: String(profile.gender ?? "unspecified"),
		activityLevel: String(profile.activityLevel ?? "moderate"),
		trainingDays: String(profile.trainingDays ?? "4"),
		dietaryPreference: String(profile.dietaryPreference ?? "none"),
	};
}

export default function GoalPlanner() {
	const [profile, setProfile] = useState(INITIAL_PROFILE);
	const [goals, setGoals] = useState([]);
	const [selectedGoal, setSelectedGoal] = useState("");
	const [plan, setPlan] = useState(null);
	const [loading, setLoading] = useState(true);
	const [savingProfile, setSavingProfile] = useState(false);
	const [loadingPlan, setLoadingPlan] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	const hasSavedProfile = useMemo(
		() => Boolean(profile.age && profile.heightCm && profile.weightKg),
		[profile],
	);

	useEffect(() => {
		let active = true;

		async function loadPlanner() {
			setLoading(true);
			setError("");

			try {
				const response = await fetch("/api/user/plan", { cache: "no-store" });
				const payload = await response.json();

				if (!response.ok) {
					if (active) {
						setError(payload?.error || "Unable to load planner data.");
					}
					return;
				}

				if (!active) {
					return;
				}

				setProfile(profileFromApi(payload?.profile));
				setGoals(Array.isArray(payload?.goals) ? payload.goals : []);
				setSelectedGoal(String(payload?.selectedGoal ?? ""));
				setPlan(payload?.plan ?? null);
			} catch {
				if (active) {
					setError("Unable to load planner data.");
				}
			} finally {
				if (active) {
					setLoading(false);
				}
			}
		}

		loadPlanner();
		return () => {
			active = false;
		};
	}, []);

	function handleProfileChange(event) {
		const { name, value } = event.target;
		setProfile((prev) => ({ ...prev, [name]: value }));
	}

	async function saveProfile(event) {
		event.preventDefault();
		setSavingProfile(true);
		setError("");
		setSuccess("");

		try {
			const response = await fetch("/api/user/plan", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ profile }),
			});
			const payload = await response.json();

			if (!response.ok) {
				setError(payload?.error || "Unable to save details.");
				return;
			}

			setProfile(profileFromApi(payload?.profile));
			setGoals(Array.isArray(payload?.goals) ? payload.goals : []);
			setSuccess("Details saved. Choose your goal to generate a plan.");
		} catch {
			setError("Unable to save details.");
		} finally {
			setSavingProfile(false);
		}
	}

	async function chooseGoal(goalId) {
		setLoadingPlan(true);
		setError("");
		setSuccess("");

		try {
			const response = await fetch("/api/user/plan", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ goalId }),
			});
			const payload = await response.json();

			if (!response.ok) {
				setError(payload?.error || "Unable to generate plan.");
				return;
			}

			setSelectedGoal(String(payload?.selectedGoal ?? goalId));
			setPlan(payload?.plan ?? null);
			setGoals(Array.isArray(payload?.goals) ? payload.goals : goals);
			setSuccess("Your plan is ready.");
		} catch {
			setError("Unable to generate plan.");
		} finally {
			setLoadingPlan(false);
		}
	}

	if (loading) {
		return (
			<section
				className="dashboard-card goal-planner-card"
				aria-label="Goal planner">
				<h2>Goal Planner</h2>
				<p>Loading your saved details...</p>
			</section>
		);
	}

	return (
		<section
			className="dashboard-card goal-planner-card"
			aria-label="Goal planner">
			<div className="goal-planner-head">
				<h2>Goal Planner</h2>
				<p>
					Save your body details once, choose your target, and get a food +
					exercise plan instantly.
				</p>
			</div>

			<form className="goal-profile-form" onSubmit={saveProfile}>
				<label>
					Age
					<input
						type="number"
						name="age"
						min="12"
						max="100"
						value={profile.age}
						onChange={handleProfileChange}
						required
					/>
				</label>
				<label>
					Height (cm)
					<input
						type="number"
						name="heightCm"
						min="120"
						max="230"
						value={profile.heightCm}
						onChange={handleProfileChange}
						required
					/>
				</label>
				<label>
					Weight (kg)
					<input
						type="number"
						name="weightKg"
						min="30"
						max="300"
						step="0.1"
						value={profile.weightKg}
						onChange={handleProfileChange}
						required
					/>
				</label>
				<label>
					Gender
					<select
						name="gender"
						value={profile.gender}
						onChange={handleProfileChange}>
						{GENDERS.map((item) => (
							<option key={item.value} value={item.value}>
								{item.label}
							</option>
						))}
					</select>
				</label>
				<label>
					Activity
					<select
						name="activityLevel"
						value={profile.activityLevel}
						onChange={handleProfileChange}>
						{ACTIVITY_LEVELS.map((item) => (
							<option key={item.value} value={item.value}>
								{item.label}
							</option>
						))}
					</select>
				</label>
				<label>
					Training Days / week
					<input
						type="number"
						name="trainingDays"
						min="1"
						max="7"
						value={profile.trainingDays}
						onChange={handleProfileChange}
					/>
				</label>
				<label className="goal-wide-field">
					Food preference
					<input
						type="text"
						name="dietaryPreference"
						value={profile.dietaryPreference}
						onChange={handleProfileChange}
						placeholder="Example: vegetarian, high protein, no seafood"
					/>
				</label>
				<button
					type="submit"
					className="btn primary goal-save-btn"
					disabled={savingProfile}>
					{savingProfile ? "Saving..." : "Save Details"}
				</button>
			</form>

			{hasSavedProfile && goals.length > 0 ? (
				<div className="goal-picker">
					<h3>Choose your target</h3>
					<div className="goal-options-grid">
						{goals.map((goal) => (
							<article
								key={goal.id}
								className={`goal-option-card ${selectedGoal === goal.id ? "active" : ""}`}>
								<div className="goal-option-top">
									<h4>{goal.title}</h4>
									{goal.recommended ? (
										<span className="role-badge user">Recommended</span>
									) : null}
								</div>
								<p>{goal.description}</p>
								<button
									type="button"
									className="btn secondary btn-small"
									onClick={() => chooseGoal(goal.id)}
									disabled={loadingPlan}>
									{loadingPlan && selectedGoal !== goal.id
										? "Generating..."
										: "Pick Goal"}
								</button>
							</article>
						))}
					</div>
				</div>
			) : null}

			{plan ? (
				<div className="goal-plan-output">
					<div className="goal-plan-summary">
						<h3>{plan.goalTitle} Plan</h3>
						<p>{plan.overview}</p>
						<ul className="dashboard-list">
							<li>Duration: {plan.durationWeeks} weeks</li>
							<li>Daily calories: {plan.dailyCalories} kcal</li>
							<li>
								Macros: P {plan.dailyMacros?.protein}g, C{" "}
								{plan.dailyMacros?.carbs}g, F {plan.dailyMacros?.fat}g
							</li>
						</ul>
					</div>

					<div className="goal-plan-grid">
						<article className="goal-plan-card">
							<h4>Food Plan</h4>
							<ul className="dashboard-list">
								{Array.isArray(plan.nutritionPlan)
									? plan.nutritionPlan.map((item) => <li key={item}>{item}</li>)
									: null}
							</ul>
						</article>
						<article className="goal-plan-card">
							<h4>Workout Plan</h4>
							<ul className="dashboard-list">
								{Array.isArray(plan.trainingPlan)
									? plan.trainingPlan.map((item) => <li key={item}>{item}</li>)
									: null}
							</ul>
						</article>
						<article className="goal-plan-card">
							<h4>Daily Habits</h4>
							<ul className="dashboard-list">
								{Array.isArray(plan.habits)
									? plan.habits.map((item) => <li key={item}>{item}</li>)
									: null}
							</ul>
						</article>
					</div>
				</div>
			) : null}

			{error ? <p className="calorie-error">{error}</p> : null}
			{success ? <p className="goal-success">{success}</p> : null}
		</section>
	);
}
