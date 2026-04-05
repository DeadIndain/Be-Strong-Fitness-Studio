"use client";

import { useMemo, useState } from "react";

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

function statusBadgeClass(status) {
	switch (status) {
		case "active":
			return "user";
		case "paused":
			return "staff";
		case "cancelled":
			return "staff";
		case "expired":
			return "staff";
		default:
			return "user";
	}
}

export default function MembershipManagementTable({
	initialUsers,
	plans,
	allowedStatus,
}) {
	const [users, setUsers] = useState(initialUsers);
	const [busyUid, setBusyUid] = useState("");
	const [message, setMessage] = useState("");

	const sortedUsers = useMemo(
		() =>
			[...users].sort((a, b) =>
				String(a.email ?? "").localeCompare(String(b.email ?? "")),
			),
		[users],
	);

	async function updateMembership(uid, payload) {
		setBusyUid(uid);
		setMessage("");
		try {
			const response = await fetch("/api/staff/memberships", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ uid, ...payload }),
			});
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data?.error || "Update failed");
			}

			setUsers((prev) =>
				prev.map((user) =>
					user.uid === uid
						? {
								...user,
								membership: {
									...(user.membership ?? {}),
									...(data?.membership ?? {}),
								},
							}
						: user,
				),
			);
			setMessage("Membership updated.");
		} catch (error) {
			setMessage(error?.message || "Unable to update membership.");
		} finally {
			setBusyUid("");
		}
	}

	return (
		<div className="rbac-table-wrap">
			{message ? <p className="auth-error muted">{message}</p> : null}
			<table className="rbac-table">
				<thead>
					<tr>
						<th>Email</th>
						<th>Name</th>
						<th>Role</th>
						<th>Plan</th>
						<th>Status</th>
						<th>Expires</th>
						<th>Action</th>
					</tr>
				</thead>
				<tbody>
					{sortedUsers.map((user) => {
						const membership = user.membership ?? null;
						const uidBusy = busyUid === user.uid;

						return (
							<tr key={user.uid}>
								<td>{user.email ?? "-"}</td>
								<td>{user.displayName ?? "-"}</td>
								<td>
									<span className={`role-badge ${user.role}`}>{user.role}</span>
								</td>
								<td>{membership?.planTitle ?? "No plan"}</td>
								<td>
									<span
										className={`role-badge ${statusBadgeClass(membership?.status)}`}>
										{membership?.status ?? "none"}
									</span>
								</td>
								<td>{formatDate(membership?.expiresAt)}</td>
								<td>
									<div className="staff-member-actions">
										<select
											disabled={uidBusy}
											onChange={(event) => {
												const planId = event.target.value;
												if (planId) {
													updateMembership(user.uid, {
														planId,
														status: "active",
													});
													event.target.value = "";
												}
											}}>
											<option value="">Assign plan</option>
											{plans.map((plan) => (
												<option key={plan.id} value={plan.id}>
													{plan.title}
												</option>
											))}
										</select>

										<select
											disabled={uidBusy}
											value={membership?.status ?? ""}
											onChange={(event) =>
												updateMembership(user.uid, {
													status: event.target.value,
												})
											}>
											<option value="" disabled>
												Status
											</option>
											{allowedStatus.map((status) => (
												<option key={status} value={status}>
													{status}
												</option>
											))}
										</select>

										{uidBusy ? (
											<span className="staff-saving">Saving...</span>
										) : null}
									</div>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
