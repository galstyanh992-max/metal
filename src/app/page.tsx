"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { AuthScreen } from "@/components/auth/auth-screen";
import { WorkspaceShell } from "@/components/shell/workspace-shell";

export default function Home() {
  const { data: session, status } = useSession();
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Բեռնվում է…</div>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen mode={authMode} onModeChange={setAuthMode} />;
  }

  return <WorkspaceShell />;
}
