"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import dynamic from "next/dynamic";

const AuthScreen = dynamic(() => import("@/components/auth/auth-screen").then((module) => module.AuthScreen));
const WorkspaceShell = dynamic(() => import("@/components/shell/workspace-shell").then((module) => module.WorkspaceShell));

export default function Home() {
  const { data: session, status } = useSession();
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  // Prevent hydration mismatch: render loading until client is ready
  const [clientReady] = useState(() => typeof window !== "undefined");

  if (!clientReady || status === "loading") {
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
