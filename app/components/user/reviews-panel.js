"use client";

import { useEffect, useMemo, useState } from "react";

function formatDate(value) {
	if (!value) {
		return "";
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "";
	}

	return date.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function stars(rating) {
	const safe = Math.max(1, Math.min(5, Number(rating) || 0));
	return "★".repeat(safe) + "☆".repeat(5 - safe);
}

export default function ReviewsPanel() {
	const [rating, setRating] = useState(5);
	const [comment, setComment] = useState("");
	const [reviews, setReviews] = useState([]);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	const remaining = useMemo(() => 280 - comment.length, [comment]);

	useEffect(() => {
		let active = true;

		async function loadReviews() {
			setLoading(true);
			setError("");
			try {
				const response = await fetch("/api/reviews", { cache: "no-store" });
				const payload = await response.json();
				if (!response.ok) {
					if (active) {
						setError(payload?.error || "Unable to load reviews.");
					}
					return;
				}

				if (active) {
					setReviews(Array.isArray(payload?.reviews) ? payload.reviews : []);
				}
			} catch {
				if (active) {
					setError("Unable to load reviews.");
				}
			} finally {
				if (active) {
					setLoading(false);
				}
			}
		}

		loadReviews();
		return () => {
			active = false;
		};
	}, []);

	async function submitReview(event) {
		event.preventDefault();
		setSubmitting(true);
		setError("");
		setSuccess("");

		try {
			const response = await fetch("/api/reviews", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ rating, comment }),
			});
			const payload = await response.json();

			if (!response.ok) {
				setError(payload?.error || "Unable to submit review.");
				return;
			}

			setComment("");
			setRating(5);
			setSuccess("Thanks for your review.");
			if (payload?.review) {
				setReviews((prev) => [payload.review, ...prev].slice(0, 20));
			}
		} catch {
			setError("Unable to submit review.");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<section
			className="dashboard-card reviews-card"
			aria-label="Member reviews">
			<div className="reviews-head">
				<h2>Member Reviews</h2>
				<p>
					Share your gym experience and help new members choose confidently.
				</p>
			</div>

			<form className="reviews-form" onSubmit={submitReview}>
				<label>
					Rating
					<select
						value={rating}
						onChange={(event) => setRating(Number(event.target.value))}>
						<option value={5}>5 - Excellent</option>
						<option value={4}>4 - Great</option>
						<option value={3}>3 - Good</option>
						<option value={2}>2 - Okay</option>
						<option value={1}>1 - Poor</option>
					</select>
				</label>

				<label className="reviews-comment-field">
					Your review
					<textarea
						value={comment}
						onChange={(event) => setComment(event.target.value)}
						minLength={8}
						maxLength={280}
						placeholder="Tell people about trainers, atmosphere, equipment, or your progress."
						required
					/>
				</label>

				<div className="reviews-form-footer">
					<p className="reviews-count">{remaining} chars left</p>
					<button
						type="submit"
						className="btn primary reviews-submit-btn"
						disabled={submitting}>
						{submitting ? "Posting..." : "Post Review"}
					</button>
				</div>
			</form>

			{error ? <p className="calorie-error">{error}</p> : null}
			{success ? <p className="goal-success">{success}</p> : null}

			<div className="reviews-list">
				{loading ? <p className="exercise-empty">Loading reviews...</p> : null}
				{!loading && reviews.length === 0 ? (
					<p className="exercise-empty">
						No reviews yet. Be the first to post one.
					</p>
				) : null}

				{reviews.map((review) => (
					<article className="review-item" key={review.id}>
						<div className="review-top">
							<strong>{review.authorName || "Member"}</strong>
							<span
								className="review-stars"
								aria-label={`${review.rating} stars`}>
								{stars(review.rating)}
							</span>
						</div>
						<p>{review.comment}</p>
						<span className="review-date">{formatDate(review.createdAt)}</span>
					</article>
				))}
			</div>
		</section>
	);
}
