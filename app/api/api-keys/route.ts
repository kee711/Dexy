import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";

import { createClient as createBrowserContextClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

function generateApiKey() {
  const prefix = randomBytes(4).toString("hex");
  const token = randomBytes(24).toString("hex");
  return { key: `dexy_${prefix}_${token}`, prefix };
}

export async function GET() {
  const supabase = await createBrowserContextClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("api_keys")
    .select("id, name, prefix, created_at, last_used_at, revoked_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ keys: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createBrowserContextClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = (body?.name ?? "Default key").toString().slice(0, 120);

  const { key, prefix } = generateApiKey();
  const keyHash = hashApiKey(key);

  try {
    const service = createServiceClient();
    const { data, error } = await service
      .from("api_keys")
      .insert({ user_id: user.id, name, key_hash: keyHash, prefix })
      .select("id, prefix, created_at")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "failed to issue key" }, { status: 500 });
    }

    return NextResponse.json({
      apiKey: key,
      prefix: data.prefix,
      createdAt: data.created_at,
    });
  } catch (error: any) {
    console.error("[api-keys] issue failed", error);
    return NextResponse.json({ error: "failed to issue key" }, { status: 500 });
  }
}
