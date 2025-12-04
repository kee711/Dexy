// app/api/session/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { getCdpBearerForValidateToken } from "@/lib/cdp/generateJwt";

const supabase = createClient();

export async function POST(req: Request) {
  const { accessToken } = await req.json();

  if (!accessToken) {
    return NextResponse.json({ error: "missing accessToken" }, { status: 400 });
  }

  const bearer = await getCdpBearerForValidateToken();

  const validateRes = await fetch(
    "https://api.cdp.coinbase.com/platform/v2/end-users/auth/validate-token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify({ accessToken }),
    }
  );

  if (!validateRes.ok) {
    const text = await validateRes.text();
    return NextResponse.json(
      { error: "invalid cdp token", detail: text },
      { status: 401 }
    );
  }

  const endUser = await validateRes.json();

  const cdpUserId: string = endUser.userId;
  const evmAddress: string | null = endUser.evmAccounts?.[0] ?? null;

  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        cdp_user_id: cdpUserId,
        address: evmAddress,
        name: "Guest",
      },
      { onConflict: "cdp_user_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ user: data });
}
