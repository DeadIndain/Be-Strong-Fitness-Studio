"use client";

import { useMemo, useState } from "react";

const SEARCH_MODES = [
	{ value: "auto", label: "Auto" },
	{ value: "name", label: "Exercise name" },
	{ value: "bodyPart", label: "Body part" },
	{ value: "target", label: "Target muscle" },
];

function toList(values) {
	if (!Array.isArray(values) || values.length === 0) {
		return [];
	}

	return values;
}

export default function WorkoutFinder() {
	const [query, setQuery] = useState("");
	const [mode, setMode] = useState("auto");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [results, setResults] = useState([]);
	const [searched, setSearched] = useState(false);

	const helperText = useMemo(() => {
		switch (mode) {
			case "bodyPart":
				return "Try chest, back, shoulders, legs, abs, or cardio.";
			case "target":
				return "Try biceps, triceps, glutes, quads, hamstrings, or calves.";
			case "name":
				return "Search an exercise name like cable fly or push up.";
			default:
				return "Search by exercise name, body part, or target muscle.";
		}
	}, [mode]);

	async function searchWorkouts(event) {
		event.preventDefault();
		const trimmed = query.trim();
		setSearched(true);
		setError("");
		setResults([]);

		if (trimmed.length < 2) {
			setError("Type at least 2 characters.");
			return;
		}

		setLoading(true);
		try {
			const params = new URLSearchParams({ q: trimmed, mode });
			const response = await fetch(`/api/workouts/search?${params.toString()}`);
			const payload = await response.json();

			if (!response.ok) {
				setError(payload?.error || "Unable to fetch workouts.");
				return;
			}

			setResults(Array.isArray(payload?.exercises) ? payload.exercises : []);
		} catch {
			setError("Unable to fetch workouts.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<section
			className="dashboard-card exercise-card"
			aria-label="Workout finder">
			<div className="exercise-head">
				<h2>Workout Finder</h2>
				<p>Search ExerciseDB for GIF demos and quick training cues.</p>
			</div>

			<form className="exercise-search" onSubmit={searchWorkouts}>
				<input
					type="text"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Example: chest, cable fly, triceps"
					aria-label="Search workout"
				/>
				<select
					value={mode}
					onChange={(event) => setMode(event.target.value)}
					aria-label="Search mode">
					{SEARCH_MODES.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
				<button
					type="submit"
					className="btn primary exercise-search-btn"
					disabled={loading}>
					{loading ? "Loading..." : "Find"}
				</button>
			</form>

			<p className="exercise-subtext">{helperText}</p>
			{error ? <p className="calorie-error">{error}</p> : null}

			<div className="exercise-grid">
				{!searched && !loading ? (
					<p className="exercise-empty">
						Search to see a few relevant exercise demos.
					</p>
				) : null}

				{searched && !loading && results.length === 0 && !error ? (
					<p className="exercise-empty">No workouts found.</p>
				) : null}

				{results.map((exercise) => (
					<article className="exercise-item" key={exercise.id}>
						{exercise.gifUrl ? (
							<div className="exercise-media">
								<img
									src={exercise.gifUrl}
									alt={exercise.name}
									className="exercise-image"
									loading="lazy"
								/>
							</div>
						) : null}
						<div className="exercise-content">
							<div className="exercise-title-row">
								<h3>{exercise.name}</h3>
								<span className="role-badge user">{exercise.bodyPart}</span>
							</div>
							<p>{exercise.target}</p>
							<ul className="exercise-meta">
								<li>Equipment: {exercise.equipment}</li>
								<li>
									Secondary:{" "}
									{toList(exercise.secondaryMuscles).slice(0, 3).join(", ") ||
										"--"}
								</li>
							</ul>
							{toList(exercise.instructions).length > 0 ? (
								<ol className="exercise-instructions">
									{toList(exercise.instructions)
										.slice(0, 3)
										.map((step, index) => (
											<li key={`${exercise.id}-${index}`}>{step}</li>
										))}
								</ol>
							) : null}
						</div>
					</article>
				))}
			</div>
		</section>
	);
}
