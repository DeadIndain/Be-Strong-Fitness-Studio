export const MEMBERSHIP_PLANS = [
	{
		id: "plan-1m",
		title: "1 Month",
		durationMonths: 1,
		priceInr: 2500,
	},
	{
		id: "plan-2m",
		title: "2 Months",
		durationMonths: 2,
		priceInr: 4500,
	},
	{
		id: "plan-3m",
		title: "3 Months",
		durationMonths: 3,
		priceInr: 6000,
	},
	{
		id: "plan-6m",
		title: "6 Months",
		durationMonths: 6,
		priceInr: 8000,
	},
	{
		id: "plan-12m",
		title: "12 Months",
		durationMonths: 12,
		priceInr: 12000,
	},
];

export const MEMBERSHIP_STATUS = {
	ACTIVE: "active",
	PAUSED: "paused",
	CANCELLED: "cancelled",
	EXPIRED: "expired",
};

export const ALLOWED_MEMBERSHIP_STATUS = new Set(
	Object.values(MEMBERSHIP_STATUS),
);

export function getMembershipPlanById(planId) {
	return MEMBERSHIP_PLANS.find((plan) => plan.id === planId) ?? null;
}
