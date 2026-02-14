import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";

const notifySchema = z.object({
  email: z.string().email({ message: "Invalid email" }),
  state: z.string().length(2).optional(),
  categories: z
    .array(z.string())
    .min(1, { message: "At least one category required" }),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = notifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { email, state, categories } = parsed.data;

  try {
    const supabase = await createServiceClient();

    // Upsert using the unique constraint on (email, COALESCE(state, '__all__'))
    // If the email+state combo already exists, update the categories array
    const { error } = await supabase
      .from("legal_notification_subscribers")
      .upsert(
        {
          email,
          state: state ?? null,
          categories,
        },
        { onConflict: "email,state" }
      );

    if (error) {
      console.error("Legal notify upsert error:", error.message);
      return NextResponse.json(
        { error: "Failed to save subscription" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
