import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";
import { getInvestigations, createInvestigation } from "@/lib/investigation-queries";
import { createInvestigationSchema } from "@/lib/investigation-validators";
import { generateSlug } from "@/lib/investigation-utils";
import { INVESTIGATION_STATUSES } from "@/types/investigations";
import type { InvestigationStatus } from "@/types/investigations";

export const dynamic = "force-dynamic";

const validStatuses = new Set<string>(INVESTIGATION_STATUSES);

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await requireAdmin(user.id);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const raw = req.nextUrl.searchParams.get("status");
    const status = raw && validStatuses.has(raw) ? (raw as InvestigationStatus) : undefined;
    const data = await getInvestigations(status);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await requireAdmin(user.id);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = createInvestigationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const slug = generateSlug(parsed.data.title);
    const investigation = await createInvestigation({
      ...parsed.data,
      slug,
      created_by: user.id,
    });

    return NextResponse.json(investigation, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
