"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  AGENT_PERMISSION_OPTIONS,
  type AgentPermission,
} from "@/lib/auth/roles";
import { Shield } from "lucide-react";

interface AgentPermissionsSelectorProps {
  selectedPermissions: AgentPermission[];
  onChange: (permissions: AgentPermission[]) => void;
  disabled?: boolean;
}

export function AgentPermissionsSelector({
  selectedPermissions,
  onChange,
  disabled = false,
}: AgentPermissionsSelectorProps) {
  const togglePermission = (key: AgentPermission) => {
    if (disabled) return;
    if (key === "inbox") return; // Inbox is mandatory for agents

    if (selectedPermissions.includes(key)) {
      onChange(selectedPermissions.filter((p) => p !== key));
    } else {
      onChange([...selectedPermissions, key]);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
        <Shield className="h-4 w-4 text-primary" />
        <span>এজেন্ট অ্যাক্সেস পারমিশন সিলেক্ট করুন (Agent Access Permissions)</span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        এজেন্ট সিলেক্ট করা হলে কেবল যে যে অপশনে পারমিশন দিবেন সেগুলোতে ঢুকতে পারবে। ইনবক্স অ্যাক্সেস বাই-ডিফল্ট পাবে।
      </p>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 pt-1">
        {AGENT_PERMISSION_OPTIONS.map((opt) => {
          const isChecked = selectedPermissions.includes(opt.key);
          const isMandatory = opt.isDefault;

          return (
            <div
              key={opt.key}
              onClick={() => togglePermission(opt.key)}
              className={`flex items-start gap-2.5 rounded-md border p-2.5 transition-colors ${
                isMandatory
                  ? "border-primary/40 bg-primary/5 cursor-default"
                  : isChecked
                    ? "border-primary/50 bg-primary/10 cursor-pointer"
                    : "border-border bg-card hover:bg-accent/50 cursor-pointer"
              }`}
            >
              <Checkbox
                id={`perm-${opt.key}`}
                checked={isChecked}
                disabled={isMandatory || disabled}
                onCheckedChange={() => togglePermission(opt.key)}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <Label
                  htmlFor={`perm-${opt.key}`}
                  className="text-xs font-medium text-foreground cursor-pointer flex items-center gap-1.5"
                >
                  {opt.defaultLabel}
                  {isMandatory && (
                    <span className="text-[10px] text-primary font-normal bg-primary/10 px-1.5 py-0.2 rounded">
                      ডিফল্ট
                    </span>
                  )}
                </Label>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {opt.defaultDescription}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
