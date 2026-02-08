import { NextRequest, NextResponse } from "next/server";
import { fetchUserMedia } from "@/lib/instagram";
import { createClient } from "@/lib/supabase/server";

function getMockMedia() {
  return Array.from({ length: 30 }, (_, i) => ({
    id: `mock-${i + 1}`,
    media_url: `https://picsum.photos/seed/mou${i + 1}/600/600`,
    thumbnail_url: `https://picsum.photos/seed/mou${i + 1}/200/200`,
  }));
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Mock mode: return sample photos when Instagram credentials aren't configured
  const isMock =
    request.nextUrl.searchParams.get("ig_mock") === "true" ||
    !process.env.INSTAGRAM_CLIENT_ID;

  if (isMock) {
    return NextResponse.json({ media: getMockMedia() });
  }

  // Get the stored Instagram token
  const { data: contributor } = await supabase
    .from("contributors")
    .select("instagram_token")
    .eq("id", user.id)
    .single();

  if (!contributor?.instagram_token) {
    return NextResponse.json(
      { error: "Instagram not connected" },
      { status: 400 }
    );
  }

  try {
    const media = await fetchUserMedia(contributor.instagram_token);

    return NextResponse.json({
      media: media.map((m) => ({
        id: m.id,
        media_url: m.media_url,
        thumbnail_url: m.thumbnail_url,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch Instagram media" },
      { status: 500 }
    );
  }
}
