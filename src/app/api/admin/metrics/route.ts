import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/lib/admin-queries";
import {
  getEnrollmentsByWeek,
  getMatchesAndTakedownsByWeek,
  getMatchesByPlatform,
  getTakedownSuccessByPlatform,
  getTotalStats,
  getDemographicCoverage,
  getOverviewMetrics,
} from "@/lib/metrics-queries";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminUser = await getAdminUser(user.id);
  if (!adminUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") || "30";
  const weeks =
    range === "7" ? 1 : range === "30" ? 4 : range === "90" ? 13 : 52;

  const [
    enrollmentsByWeek,
    matchesTakedownsByWeek,
    matchesByPlatform,
    takedownByPlatform,
    totalStats,
    demographics,
    overview,
  ] = await Promise.all([
    getEnrollmentsByWeek(weeks),
    getMatchesAndTakedownsByWeek(weeks),
    getMatchesByPlatform(),
    getTakedownSuccessByPlatform(),
    getTotalStats(),
    getDemographicCoverage(),
    getOverviewMetrics(),
  ]);

  // TODO: Mock data for metrics not yet instrumented
  const mockFunnel = [
    { step: "Visit Landing Page", value: 12680, percentage: 100 },
    { step: "Create Account", value: 4820, percentage: 38 },
    { step: "Verify Identity", value: 3210, percentage: 25.3 },
    { step: "Upload Photos", value: 2840, percentage: 22.4 },
    { step: "Set Preferences", value: 2560, percentage: 20.2 },
    { step: "Complete Enrollment", value: 2180, percentage: 17.2 },
  ];

  // TODO: Mock growth data — requires referral tracking, churn tracking, acquisition cost data
  const mockGrowth = {
    monthlyChurnRate: 2.1,
    churnChange: -0.3,
    referralRate: 23,
    referralChange: 5,
    acquisitionCost: 12.5,
    acquisitionChange: -8,
    organicVsReferred: enrollmentsByWeek.map((w) => ({
      week: w.week,
      organic: Math.round(w.value * 0.77),
      referred: Math.round(w.value * 0.23),
    })),
    churnReasons: [
      { reason: "Privacy concerns", count: 34, percentage: 28 },
      { reason: "Not enough matches", count: 29, percentage: 24 },
      { reason: "Found alternative", count: 22, percentage: 18 },
      { reason: "Too expensive", count: 18, percentage: 15 },
      { reason: "Technical issues", count: 11, percentage: 9 },
      { reason: "Other", count: 8, percentage: 6 },
    ],
  };

  // TODO: Mock marketplace data — requires opt-in flag, brand waitlist, brief tracking
  const mockMarketplace = {
    optedInPercentage: 67,
    optedInChange: 12,
    brandWaitlist: 34,
    brandWaitlistChange: 8,
    conciergeBriefs: 12,
    conciergeBriefsChange: 3,
  };

  // TODO: Mock time to first scan — requires timestamp tracking
  const mockTimeToScan = enrollmentsByWeek.map((w) => ({
    week: w.week,
    hours: Math.round(20 + Math.random() * 8),
  }));

  // TODO: Mock MRR — requires billing tables
  const mockMrr = 0;
  const mockMrrChange = 0;

  // TODO: Mock conversion rate — requires subscription tracking
  const mockConversion = 0;
  const mockConversionChange = 0;

  return NextResponse.json({
    overview: {
      ...overview,
      mrr: mockMrr,
      mrrChange: mockMrrChange,
      conversion: mockConversion,
      conversionChange: mockConversionChange,
      timeToScan: mockTimeToScan,
    },
    enrollments: enrollmentsByWeek,
    funnel: mockFunnel,
    enforcement: {
      matchesTakedownsByWeek,
      matchesByPlatform,
      takedownByPlatform,
      totalStats,
    },
    growth: mockGrowth,
    marketplace: {
      ...mockMarketplace,
      demographics,
    },
  });
}
