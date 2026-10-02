// ============================================================
// /api/account/members/[userId]
//
//   PATCH  — change a member's role.   Admin+.
//   DELETE — remove a member.          Admin+.
//
// Both delegate to SECURITY DEFINER RPCs from migration 018:
//   - set_member_role(p_user_id, p_new_role)
//   - remove_account_member(p_user_id)
//
// The RPCs do the *real* authorisation work — caller must be
// admin+, target must be in caller's account, target can't be the
// owner, can't be self. The TS layer here only forwards the call
// and maps Postgres SQLSTATEs back to HTTP statuses.
// ============================================================

import { NextResponse } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { isAccountRole, parseAgentPermissions } from "@/lib/auth/roles";
import { supabaseAdmin } from "@/lib/ai/admin-client";
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from "@/lib/rate-limit";

// Map known SQLSTATEs from the RPCs (see migration 018) onto HTTP
// statuses. The `error.code` field is the SQLSTATE; the `message`
// is the human-readable RAISE message we put in the migration.
function rpcErrorToResponse(err: PostgrestError): NextResponse {
  if (err.code === "42501") {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  if (err.code === "22023") {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  console.error("[members route] unexpected RPC error:", err);
  return NextResponse.json(
    { error: "Failed to update member" },
    { status: 500 },
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const ctx = await requireRole("admin");

    const limit = checkRateLimit(
      `admin:memberRole:${ctx.userId}`,
      RATE_LIMITS.adminAction,
    );
    if (!limit.success) return rateLimitResponse(limit);

    const { userId } = await params;

    const body = (await request.json().catch(() => null)) as
      | { role?: unknown; agentPermissions?: unknown }
      | null;
    const role = body?.role;
    const rawAgentPerms = body?.agentPermissions;

    if (role !== undefined) {
      if (!isAccountRole(role)) {
        return NextResponse.json(
          { error: "'role' must be one of owner, admin, agent, viewer" },
          { status: 400 },
        );
      }

      if (role === "owner") {
        return NextResponse.json(
          {
            error:
              "Use POST /api/account/transfer-ownership to promote a member to owner",
          },
          { status: 400 },
        );
      }

      const { error } = await ctx.supabase.rpc("set_member_role", {
        p_user_id: userId,
        p_new_role: role,
      });

      if (error) return rpcErrorToResponse(error);
    }

    // Handle agent_permissions update if provided
    if (Array.isArray(rawAgentPerms)) {
      const dbAdmin = supabaseAdmin();
      const perms = parseAgentPermissions(rawAgentPerms as string[]);

      // First fetch target profile to get existing beta_features
      const { data: targetProfile } = await dbAdmin
        .from("profiles")
        .select("beta_features")
        .eq("user_id", userId)
        .maybeSingle();

      const existingBeta = ((targetProfile?.beta_features as string[] | null) ?? []).filter(
        (f: string) => !f.startsWith("perm:")
      );
      const permBetaFlags = perms.map((p) => `perm:${p}`);
      const newBeta = Array.from(new Set([...existingBeta, ...permBetaFlags]));

      // Update both agent_permissions and beta_features
      const updatePayload: Record<string, unknown> = {
        agent_permissions: perms,
        beta_features: newBeta,
      };

      const { error: updateErr } = await dbAdmin
        .from("profiles")
        .update(updatePayload)
        .eq("user_id", userId);

      // If updating agent_permissions failed (e.g. column not in schema cache), retry with beta_features only
      if (updateErr && updateErr.code === "42703") {
        await dbAdmin
          .from("profiles")
          .update({ beta_features: newBeta })
          .eq("user_id", userId);
      } else if (updateErr) {
        console.error("[PATCH /api/account/members/[userId]] perms update error:", updateErr);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const ctx = await requireRole("admin");

    const limit = checkRateLimit(
      `admin:memberRemove:${ctx.userId}`,
      RATE_LIMITS.adminAction,
    );
    if (!limit.success) return rateLimitResponse(limit);

    const { userId } = await params;

    const { data, error } = await ctx.supabase.rpc("remove_account_member", {
      p_user_id: userId,
    });

    if (error) return rpcErrorToResponse(error);

    return NextResponse.json({ ok: true, newPersonalAccountId: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
