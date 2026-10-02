// ============================================================
// Account role helpers — pure, unit-testable, no I/O.
//
// Mirrors the `account_role_enum` Postgres type from migration
// 017_account_sharing.sql. The hierarchy is intentionally a flat
// ordinal (owner=4 … viewer=1) — it matches the same CASE
// expression the `is_account_member(account_id, min_role)` SQL
// helper uses, so server-side TypeScript guards and database-side
// RLS speak the same language.
//
// Predicates (`canManageMembers`, `canEditSettings`, …) are the
// single source of truth for "what can this role do?" — both
// API route guards and UI gates should call them rather than
// open-coding their own role checks. That keeps role-policy
// changes a one-file diff.
// ============================================================

export type AccountRole = "owner" | "admin" | "agent" | "viewer";

/** Ordered list of every valid role, lowest privilege first. */
export const ACCOUNT_ROLES: readonly AccountRole[] = [
  "viewer",
  "agent",
  "admin",
  "owner",
] as const;

/**
 * Numeric rank of a role. Higher = more privileged. Mirrors the
 * CASE expression in `is_account_member` so JS/SQL stay aligned.
 */
export function roleRank(role: AccountRole): number {
  switch (role) {
    case "owner":
      return 4;
    case "admin":
      return 3;
    case "agent":
      return 2;
    case "viewer":
      return 1;
  }
}

/**
 * True iff `role` is at least as privileged as `min`. Use this
 * for any "user has at least admin" / "at least agent" checks.
 */
export function hasMinRole(role: AccountRole, min: AccountRole): boolean {
  return roleRank(role) >= roleRank(min);
}

/** Type-narrow an unknown string into a valid `AccountRole`. */
export function isAccountRole(value: unknown): value is AccountRole {
  return (
    typeof value === "string" &&
    (ACCOUNT_ROLES as readonly string[]).includes(value)
  );
}

// ============================================================
// Capability predicates
//
// Every UI gate and API route guard should call one of these
// instead of comparing role strings inline. Adding a capability
// = one new predicate here + one call site change per consumer.
// ============================================================

/** Owner / admin: invite, remove, change roles. */
export function canManageMembers(role: AccountRole): boolean {
  return hasMinRole(role, "admin");
}

/**
 * Owner / admin: edit account-wide settings (WhatsApp config,
 * message templates, pipelines, tags, custom fields, account
 * name). Excludes per-user settings like avatar or own password.
 */
export function canEditSettings(role: AccountRole): boolean {
  return hasMinRole(role, "admin");
}

/**
 * Owner / admin / agent: write operational data — send messages,
 * create contacts, move deals, run broadcasts, edit automations.
 * Viewers are read-only.
 */
export function canSendMessages(role: AccountRole): boolean {
  return hasMinRole(role, "agent");
}

/**
 * Viewer: read-only across everything. Provided as a positive
 * predicate so UI gates read naturally (`if (canViewOnly(role))`
 * shows the "Read-only" tooltip without inverting `canSendMessages`).
 */
export function canViewOnly(role: AccountRole): boolean {
  return role === "viewer";
}

/** Owner only: irreversible destructive operations. */
export function canDeleteAccount(role: AccountRole): boolean {
  return role === "owner";
}

/** Owner only: hand the account to another member. */
export function canTransferOwnership(role: AccountRole): boolean {
  return role === "owner";
}

// ============================================================
// Granular Agent Permissions
//
// Allows restricting what an Agent team member can see and access.
// Inbox is always granted by default. Other sections (Dashboard,
// Contacts, Pipelines, Broadcasts, Automations, Flows, AI Agents,
// Notifications) can be granted per-agent upon invite or edit.
// Owner / Admin / Viewer roles have access to all sections.
// ============================================================

export type AgentPermission =
  | "inbox"
  | "dashboard"
  | "notifications"
  | "contacts"
  | "pipelines"
  | "broadcasts"
  | "automations"
  | "flows"
  | "agents"
  | "settings";

export interface PermissionOption {
  key: AgentPermission;
  labelKey: string;
  defaultLabel: string;
  descriptionKey: string;
  defaultDescription: string;
  isDefault?: boolean;
}

export const AGENT_PERMISSION_OPTIONS: readonly PermissionOption[] = [
  {
    key: "inbox",
    labelKey: "permInbox",
    defaultLabel: "Inbox (ইনবক্স / মেসেজ)",
    descriptionKey: "permInboxDesc",
    defaultDescription: "View and respond to customer conversations",
    isDefault: true,
  },
  {
    key: "dashboard",
    labelKey: "permDashboard",
    defaultLabel: "Dashboard (ড্যাশবোর্ড)",
    descriptionKey: "permDashboardDesc",
    defaultDescription: "View account analytics and message statistics",
  },
  {
    key: "notifications",
    labelKey: "permNotifications",
    defaultLabel: "Notifications (নোটিফিকেশন)",
    descriptionKey: "permNotificationsDesc",
    defaultDescription: "View system alerts and activity notifications",
  },
  {
    key: "contacts",
    labelKey: "permContacts",
    defaultLabel: "Contacts (কন্টাক্টস)",
    descriptionKey: "permContactsDesc",
    defaultDescription: "View and manage customer contact list",
  },
  {
    key: "pipelines",
    labelKey: "permPipelines",
    defaultLabel: "Pipelines (পাইপলাইন ও ডিল)",
    descriptionKey: "permPipelinesDesc",
    defaultDescription: "View and move deal stages in sales pipelines",
  },
  {
    key: "broadcasts",
    labelKey: "permBroadcasts",
    defaultLabel: "Broadcasts (ব্রডকাস্ট)",
    descriptionKey: "permBroadcastsDesc",
    defaultDescription: "Create and send bulk message broadcasts",
  },
  {
    key: "automations",
    labelKey: "permAutomations",
    defaultLabel: "Automations (অটোমেশন)",
    descriptionKey: "permAutomationsDesc",
    defaultDescription: "Configure message auto-responders and triggers",
  },
  {
    key: "flows",
    labelKey: "permFlows",
    defaultLabel: "Flows (ফ্লো বিল্ডার)",
    descriptionKey: "permFlowsDesc",
    defaultDescription: "Build interactive chatbot conversation flows",
  },
  {
    key: "agents",
    labelKey: "permAgents",
    defaultLabel: "AI Agents (এআই এজেন্ট)",
    descriptionKey: "permAgentsDesc",
    defaultDescription: "View and configure AI support agent settings",
  },
  {
    key: "settings",
    labelKey: "permSettings",
    defaultLabel: "Settings (সেটিংস)",
    descriptionKey: "permSettingsDesc",
    defaultDescription: "View and configure account settings",
  },
] as const;

export const DEFAULT_AGENT_PERMISSIONS: AgentPermission[] = ["inbox"];

/** Parse raw permission array or fallback from beta_features */
export function parseAgentPermissions(
  agentPerms: string[] | null | undefined,
  betaFeatures?: string[] | null
): AgentPermission[] {
  const result = new Set<AgentPermission>(["inbox"]);
  if (Array.isArray(agentPerms)) {
    for (const p of agentPerms) {
      if (p && AGENT_PERMISSION_OPTIONS.some((opt) => opt.key === p)) {
        result.add(p as AgentPermission);
      }
    }
  }
  if (Array.isArray(betaFeatures)) {
    for (const f of betaFeatures) {
      if (f.startsWith("perm:")) {
        const key = f.slice(5);
        if (AGENT_PERMISSION_OPTIONS.some((opt) => opt.key === key)) {
          result.add(key as AgentPermission);
        }
      }
    }
  }
  return Array.from(result);
}

/**
 * Returns true if the given role + agent_permissions allows accessing a feature/page.
 * Owner, Admin, and Viewer always have access to all sections.
 * Agent only has access if the feature is explicitly in `agentPermissions` (or 'inbox').
 */
export function hasPermission(
  role: AccountRole | null | undefined,
  permissionKey: AgentPermission | string,
  agentPermissions?: string[] | null
): boolean {
  if (!role) return false;
  if (role === "owner" || role === "admin" || role === "viewer") {
    return true;
  }
  if (role === "agent") {
    if (permissionKey === "inbox") return true;
    if (!agentPermissions || agentPermissions.length === 0) {
      return permissionKey === "inbox";
    }
    return agentPermissions.includes(permissionKey as AgentPermission);
  }
  return false;
}
