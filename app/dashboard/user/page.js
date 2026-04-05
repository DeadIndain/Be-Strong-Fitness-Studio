import { requireAuth } from "../../../lib/auth/server";
import { USER_ROLES } from "../../../lib/constants/auth";
import CalorieCalculator from "@/app/components/user/calorie-calculator";
import WorkoutFinder from "@/app/components/user/workout-finder";

export default async function UserDashboardPage() {
	await requireAuth({ role: USER_ROLES.USER });

	return (
		<div className="dashboard-stack">
			<div className="dashboard-card">
				<h2>Welcome, Member</h2>
				<p>Your account is active. This area is reserved for standard users.</p>
				<ul className="dashboard-list">
					<li>Access personalized plans and updates.</li>
					<li>Track your transformation progress.</li>
					<li>Get announcements from gym staff.</li>
				</ul>
			</div>

			<CalorieCalculator />
			<WorkoutFinder />
		</div>
	);
}
