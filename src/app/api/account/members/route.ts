// ============================================================
// GET /api/account/members
//
// Lists every member of the caller's account. Any member can call
// it (the Members tab is shown to admins+, but agents/viewers see
// a read-only roster too).
//
// Field visibility
//   Sensitive fields (email) are returned only when the caller is
//   admin+. Agents and viewers see name + avatar + role + joined
//   date only. This mirrors the design decision from the planning
//   phase: "agent/viewer sees names only".
// ============================================================

import { NextResponse } from "next/server";

import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";
import { canManageMembers, isAccountRole } from "@/lib/auth/roles";
import { parseAgentPermissions } from "@/lib/auth/roles";
import type { AccountMember } from "@/types";

interface ProfileRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  account_role: string;
  agent_permissions?: string[] | null;
  beta_features?: string[] | null;
  created_at: string;
}

export async function GET() {
  try {
    const ctx = await getCurrentAccount();

    // Try selecting agent_permissions along with beta_features
    let queryData: ProfileRow[] | null = null;
    const { data, error } = await ctx.supabase
      .from("profiles")
      .select("user_id, full_name, email, avatar_url, account_role, agent_permissions, beta_features, created_at")
      .eq("account_id", ctx.accountId)
      .order("created_at", { ascending: true });

    if (error && error.code === '42703') {
      const fallback = await ctx.supabase
        .from("profiles")
        .select("user_id, full_name, email, avatar_url, account_role, beta_features, created_at")
        .eq("account_id", ctx.accountId)
        .order("created_at", { ascending: true });
      if (fallback.error) {
        console.error("[GET /api/account/members] fallback error:", fallback.error);
        return NextResponse.json({ error: "Failed to load members" }, { status: 500 });
      }
      queryData = fallback.data as ProfileRow[];
    } else if (error) {
      console.error("[GET /api/account/members] fetch error:", error);
      return NextResponse.json({ error: "Failed to load members" }, { status: 500 });
    } else {
      queryData = data as ProfileRow[];
    }

    const canSeeEmails = canManageMembers(ctx.role);

    const members: AccountMember[] = (queryData ?? []).flatMap((row) => {
      if (!isAccountRole(row.account_role)) return [];
      const perms = parseAgentPermissions(row.agent_permissions, row.beta_features);
      return [
        {
          user_id: row.user_id,
          full_name: row.full_name ?? "",
          email: canSeeEmails ? row.email : null,
          avatar_url: row.avatar_url,
          role: row.account_role,
          agent_permissions: perms,
          joined_at: row.created_at,
        },
      ];
    });

    return NextResponse.json({ members });
  } catch (err) {
    return toErrorResponse(err);
  }
}
