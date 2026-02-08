import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createServiceClient();
    const { error } = await supabase
      .from("contributors")
      .select("id", { count: "exact", head: true });

    if (error) {
      return NextResponse.json(
        { status: "unhealthy", db: "error" },
        { status: 503 }
      );
    }

    return NextResponse.json({ status: "healthy", db: "connected" });
  } catch {
    return NextResponse.json(
      { status: "unhealthy", db: "unreachable" },
      { status: 503 }
    );
  }
}
