import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";

const TEST_EMAIL_PATTERN = "@madeofus.test";

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await requireAdmin(user.id, "admin");
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = await createServiceClient();

  try {
    // Find all test users by email pattern
    const { data: testUsers, error: listErr } =
      await service.auth.admin.listUsers({ perPage: 1000 });

    if (listErr) throw new Error(`List users failed: ${listErr.message}`);

    const testUserIds = testUsers.users
      .filter((u) => u.email?.endsWith(TEST_EMAIL_PATTERN))
      .map((u) => u.id);

    if (testUserIds.length === 0) {
      return NextResponse.json({
        success: true,
        deleted: 0,
        message: "No test users found",
      });
    }

    // Delete storage files for each test user
    for (const userId of testUserIds) {
      const { data: files } = await service.storage
        .from("sfw-uploads")
        .list(userId);

      if (files && files.length > 0) {
        const paths = files.map((f) => `${userId}/${f.name}`);
        await service.storage.from("sfw-uploads").remove(paths);
      }
    }

    // Delete auth users (cascades to contributors and child tables via FK)
    const errors: string[] = [];
    for (const userId of testUserIds) {
      const { error } = await service.auth.admin.deleteUser(userId);
      if (error) {
        errors.push(`${userId}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      deleted: testUserIds.length - errors.length,
      total: testUserIds.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cleanup failed" },
      { status: 500 }
    );
  }
}
