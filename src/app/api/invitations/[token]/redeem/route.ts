// ============================================================
// POST /api/invitations/[token]/redeem
//
// Authenticated. Caller atomically moves from their personal
// account (created at signup) to the inviter's account with the
// invite's role. Heavy lifting lives in the SECURITY DEFINER
// `redeem_invitation` RPC from migration 019.
//
// Refusal contract (from the RPC)
//   - SQLSTATE 42501 → 401 (caller not authenticated)
//   - SQLSTATE 22023 → 400 (invitation not_found / used / expired)
//   - SQLSTATE 23505 → 409 (caller's account already has data /
//     they're already in this or another shared account)
//
// Rate limit (per IP) is the same shape as peek but tighter —
// a successful redeem changes data, and the RPC's data-loss
// guard makes brute-force retries pointless past a few attempts.
// ============================================================

import { NextResponse } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";

import { hashInviteToken } from "@/lib/auth/invitations";
import { parseAgentPermissions } from "@/lib/auth/roles";
import { supabaseAdmin } from "@/lib/ai/admin-client";
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = request.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

function rpcErrorToResponse(err: PostgrestError): NextResponse {
  if (err.code === "42501") {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  if (err.code === "22023") {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  if (err.code === "23505") {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
  console.error("[redeem] unexpected RPC error:", err);
  return NextResponse.json(
    { error: "Failed to redeem invitation" },
    { status: 500 },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`redeem:${ip}`, RATE_LIMITS.invitationRedeem);
  if (!limit.success) return rateLimitResponse(limit);

  const { token } = await params;
  if (!token || typeof token !== "string") {
    return NextResponse.json(
      { error: "Missing invitation token" },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  // The RPC checks `auth.uid()` itself, but failing fast here
  // gives a cleaner 401 without a Supabase round trip on the
  // common "user clicked the link before logging in" path.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tokenHash = hashInviteToken(token);

  // Read invitation row before redeeming to get agent_permissions
  const dbAdmin = supabaseAdmin();
  const { data: invRow } = await dbAdmin
    .from("account_invitations")
    .select("role, agent_permissions")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  const { data: accountId, error } = await supabase.rpc("redeem_invitation", {
    p_token_hash: tokenHash,
  });

  if (error) return rpcErrorToResponse(error);

  // If redeemed invitation had agent_permissions or was for agent role, update profile
  if (invRow && (invRow.role === "agent" || invRow.agent_permissions)) {
    const perms = parseAgentPermissions((invRow as any).agent_permissions);
    const permBetaFlags = perms.map((p) => `perm:${p}`);

    const { data: userProfile } = await dbAdmin
      .from("profiles")
      .select("beta_features")
      .eq("user_id", user.id)
      .maybeSingle();

    const existingBeta = (userProfile?.beta_features ?? []).filter(
      (f) => !f.startsWith("perm:")
    );
    const newBeta = Array.from(new Set([...existingBeta, ...permBetaFlags]));

    const { error: updateErr } = await dbAdmin
      .from("profiles")
      .update({
        agent_permissions: perms,
        beta_features: newBeta,
      })
      .eq("user_id", user.id);

    if (updateErr && updateErr.code === "42703") {
      await dbAdmin
        .from("profiles")
        .update({ beta_features: newBeta })
        .eq("user_id", user.id);
    }
  }

  return NextResponse.json({ ok: true, accountId });
}
