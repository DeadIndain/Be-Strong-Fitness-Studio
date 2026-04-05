"use client";

import { useMemo, useState } from "react";

const PRIMARY_METRICS = [
	{ key: "calories", label: "Calories", unit: "kcal" },
	{ key: "protein", label: "Protein", unit: "g" },
	{ key: "carbs", label: "Carbs", unit: "g" },
	{ key: "fat", label: "Fat", unit: "g" },
];

const SECONDARY_METRICS = [
	{ key: "fiber", label: "Fiber", unit: "g" },
	{ key: "sugar", label: "Sugar", unit: "g" },
	{ key: "sodium", label: "Sodium", unit: "g" },
];

function metricValue(value, unit) {
	if (value == null || Number.isNaN(value)) {
		return "--";
	}

	return `${value} ${unit}`;
}

export default function CalorieCalculator() {
	const [query, setQuery] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [result, setResult] = useState(null);

	const hasResult = Boolean(result?.item);
	const sourceLabel = useMemo(() => {
		if (!hasResult) {
			return "";
		}

		return `${result.item.source} nutrition`;
	}, [hasResult, result]);

	async function onSearch(event) {
		event.preventDefault();
		setError("");

		if (query.trim().length < 2) {
			setError("Type at least 2 characters.");
			return;
		}

		setLoading(true);
		try {
			const response = await fetch(
				`/api/nutrition/search?q=${encodeURIComponent(query)}`,
			);
			const payload = await response.json();

			if (!response.ok) {
				setResult(null);
				setError(payload?.error || "Search failed.");
				return;
			}

			setResult(payload);
		} catch {
			setResult(null);
			setError("Unable to fetch nutrition data.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<section
			className="dashboard-card calorie-card"
			aria-label="Calorie calculator">
			<div className="calorie-head">
				<h2>Calorie Calculator</h2>
				<p>Search a food or dish to get calories and nutrients.</p>
			</div>

			<form className="calorie-search" onSubmit={onSearch}>
				<input
					type="text"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Example: boiled eggs, chicken curry, banana"
					aria-label="Search food"
				/>
				<button
					type="submit"
					className="btn primary calorie-search-btn"
					disabled={loading}>
					{loading ? "Searching..." : "Search"}
				</button>
			</form>

			{error ? <p className="calorie-error">{error}</p> : null}

			{hasResult ? (
				<div className="calorie-result">
					<div className="calorie-image-wrap">
						<img
							src={result.item.image}
							alt={result.item.name}
							className="calorie-image"
							loading="lazy"
						/>
					</div>
					<div className="calorie-data">
						<div className="calorie-title-row">
							<h3>{result.item.name}</h3>
							<span className="role-badge user">{sourceLabel}</span>
						</div>
						<p className="calorie-subtext">
							{result.item.servingBasis} · Image: {result.item.imageSource}
						</p>

						<div className="calorie-metrics-grid">
							{PRIMARY_METRICS.map((metric) => (
								<article className="calorie-metric" key={metric.key}>
									<span>{metric.label}</span>
									<strong>
										{metricValue(
											result.item.nutrients?.[metric.key],
											metric.unit,
										)}
									</strong>
								</article>
							))}
						</div>

						<div className="calorie-extra-metrics">
							{SECONDARY_METRICS.map((metric) => (
								<p key={metric.key}>
									{metric.label}:{" "}
									{metricValue(
										result.item.nutrients?.[metric.key],
										metric.unit,
									)}
								</p>
							))}
						</div>
					</div>
				</div>
			) : null}
		</section>
	);
}
