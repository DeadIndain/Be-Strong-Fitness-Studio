import { requireAuth } from "../../../lib/auth/server";
import { USER_ROLES } from "../../../lib/constants/auth";
import {
	ALLOWED_MEMBERSHIP_STATUS,
	MEMBERSHIP_PLANS,
} from "../../../lib/constants/memberships";
import { adminAuth } from "../../../lib/firebase/admin";
import { adminDb } from "../../../lib/firebase/admin";
import MembershipManagementTable from "../../components/staff/membership-management-table";
import UserManagementTable from "../../components/staff/user-management-table";

export default async function StaffDashboardPage() {
	const session = await requireAuth({ role: USER_ROLES.STAFF });
	const usersResult = await adminAuth.listUsers(1000);
	const membershipsSnapshot = await adminDb.collection("userMemberships").get();
	const membershipsByUid = new Map();
	membershipsSnapshot.forEach((doc) => {
		membershipsByUid.set(doc.id, doc.data());
	});

	const users = usersResult.users.map((userRecord) => {
		return {
			uid: userRecord.uid,
			email: userRecord.email ?? null,
			displayName: userRecord.displayName ?? null,
			role:
				userRecord.customClaims?.role === USER_ROLES.STAFF ? "staff" : "user",
			membership: membershipsByUid.get(userRecord.uid) ?? null,
		};
	});

	return (
		<div className="dashboard-stack">
			<div className="dashboard-card">
				<h2>Staff User Management</h2>
				<p>
					Manage user roles securely. Role changes are processed server-side.
				</p>
				<UserManagementTable initialUsers={users} currentUid={session.uid} />
			</div>

			<div className="dashboard-card">
				<h2>Memberships & Members</h2>
				<p>
					Assign plans, change status, and manage memberships from one table.
				</p>
				<MembershipManagementTable
					initialUsers={users}
					plans={MEMBERSHIP_PLANS}
					allowedStatus={Array.from(ALLOWED_MEMBERSHIP_STATUS)}
				/>
			</div>
		</div>
	);
}
