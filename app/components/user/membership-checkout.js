"use client";

import { useEffect, useMemo, useState } from "react";

function formatDate(value) {
	if (!value) {
		return "--";
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "--";
	}

	return date.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export default function MembershipCheckout() {
	const [plans, setPlans] = useState([]);
	const [membership, setMembership] = useState(null);
	const [loading, setLoading] = useState(true);
	const [busyPlanId, setBusyPlanId] = useState("");
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	const currentPlanLabel = useMemo(() => {
		if (!membership?.planTitle) {
			return "No active membership";
		}
		return `${membership.planTitle} (${membership.status || "unknown"})`;
	}, [membership]);

	useEffect(() => {
		let active = true;

		async function loadMembership() {
			setLoading(true);
			setError("");
			try {
				const response = await fetch("/api/user/membership", {
					cache: "no-store",
				});
				const payload = await response.json();
				if (!response.ok) {
					if (active) {
						setError(payload?.error || "Unable to load membership plans.");
					}
					return;
				}

				if (active) {
					setPlans(Array.isArray(payload?.plans) ? payload.plans : []);
					setMembership(payload?.membership ?? null);
				}
			} catch {
				if (active) {
					setError("Unable to load membership plans.");
				}
			} finally {
				if (active) {
					setLoading(false);
				}
			}
		}

		loadMembership();
		return () => {
			active = false;
		};
	}, []);

	async function checkout(planId) {
		setBusyPlanId(planId);
		setError("");
		setSuccess("");

		try {
			const response = await fetch("/api/user/membership", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ planId }),
			});
			const payload = await response.json();
			if (!response.ok) {
				setError(payload?.error || "Unable to activate membership.");
				return;
			}

			setMembership(payload?.membership ?? null);
			setSuccess(payload?.message || "Membership activated.");
		} catch {
			setError("Unable to activate membership.");
		} finally {
			setBusyPlanId("");
		}
	}

	return (
		<section
			className="dashboard-card membership-card"
			aria-label="Membership checkout">
			<div className="membership-head">
				<h2>Membership Checkout</h2>
				<p>
					Placeholder checkout is enabled. Payments will be integrated with
					Stripe later.
				</p>
			</div>

			<div className="membership-current">
				<p>Current: {currentPlanLabel}</p>
				<p>
					Started: {formatDate(membership?.startedAt)} · Expires:{" "}
					{formatDate(membership?.expiresAt)}
				</p>
			</div>

			{loading ? <p className="exercise-empty">Loading plans...</p> : null}

			<div className="membership-grid">
				{plans.map((plan) => {
					const disabled = busyPlanId === plan.id;
					return (
						<article className="membership-item" key={plan.id}>
							<h3>{plan.title}</h3>
							<p className="membership-price">Rs {plan.priceInr}</p>
							<p>{plan.durationMonths} month access</p>
							<button
								type="button"
								className="btn primary membership-checkout-btn"
								onClick={() => checkout(plan.id)}
								disabled={disabled}>
								{disabled ? "Processing..." : "Checkout"}
							</button>
						</article>
					);
				})}
			</div>

			{error ? <p className="calorie-error">{error}</p> : null}
			{success ? <p className="goal-success">{success}</p> : null}
		</section>
	);
}
