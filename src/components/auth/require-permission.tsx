"use client";

import { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface RequirePermissionProps {
  permission: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export function RequirePermission({
  permission,
  fallback,
  children,
}: RequirePermissionProps) {
  const { profileLoading, hasPermission } = useAuth();

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const allowed = hasPermission(permission);

  if (!allowed) {
    if (fallback) return <>{fallback}</>;

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6 bg-card border border-border rounded-xl max-w-lg mx-auto my-8 shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 mb-4">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-bold text-foreground mb-2">
          অ্যাক্সেস সীমিত (Access Restricted)
        </h2>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          আপনার টিম মেম্বার এজেন্টের জন্য এই সেকশনে পারমিশন দেওয়া নেই। এই ফিচারটি দেখতে চাইলে আপনার অ্যাকাউন্টের এডমিনকে পারমিশন আপডেট করার অনুরোধ করুন।
        </p>
        <Button asChild className="gap-2">
          <Link href="/inbox">
            <ArrowLeft className="h-4 w-4" />
            ইনবক্সে ফিরে যান (Go to Inbox)
          </Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
