"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, User, Building2, Lock } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { signIn } from "next-auth/react";
import { toast } from "sonner";

export function AuthScreen({ mode, onModeChange }: { mode: "signin" | "signup"; onModeChange: (m: "signin" | "signup") => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (!res?.ok) {
      setError("Սխալ էլ․ հասցե կամ գաղտնաբառ");
    } else {
      window.location.reload();
    }
  };

  const fillDemo = (em: string, pw: string) => {
    setEmail(em);
    setPassword(pw);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src="/logo.jpeg" alt="Arm Roll" className="size-12 rounded-xl" />
          <div>
            <div className="text-2xl font-bold tracking-tight">ARM ROLL</div>
            <div className="text-xs text-muted-foreground tracking-widest uppercase">ERP · CRM — Armenia</div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl p-8" style={{ boxShadow: "0 2px 20px oklch(0 0 0 / 0.06)" }}>
          <h1 className="text-xl font-semibold mb-1">Մուտք համակարգ</h1>
          <p className="text-sm text-muted-foreground mb-6">Մուտքագրեք ձեր տվյալները</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">ԷԼ․ ՀԱՍՑԵ</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="h-11 rounded-lg"
                placeholder="admin@armroll.am"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">ԳԱՂՏՆԱԲԱՌ</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 rounded-lg"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/5 px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full h-11 rounded-lg text-sm font-medium">
              {loading ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-4" />}
              Մուտք
            </Button>
          </form>

          {/* Demo accounts */}
          <div className="mt-6 pt-6 border-t border-hairline">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Դեմո հաշիվներ</div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => fillDemo("admin1@armroll.am", "admin123")} className="text-left p-2 rounded-lg hover:bg-muted/40 transition-colors">
                <div className="text-xs font-medium">Ադմին</div>
                <div className="text-[10px] text-muted-foreground">admin1@armroll.am</div>
              </button>
              <button onClick={() => fillDemo("operator@armroll.am", "operator123")} className="text-left p-2 rounded-lg hover:bg-muted/40 transition-colors">
                <div className="text-xs font-medium">Օպերատոր</div>
                <div className="text-[10px] text-muted-foreground">operator@armroll.am</div>
              </button>
              <button onClick={() => fillDemo("warehouse@armroll.am", "warehouse123")} className="text-left p-2 rounded-lg hover:bg-muted/40 transition-colors">
                <div className="text-xs font-medium">Պահեստապետ</div>
                <div className="text-[10px] text-muted-foreground">warehouse@armroll.am</div>
              </button>
              <button onClick={() => fillDemo("admin2@armroll.am", "admin123")} className="text-left p-2 rounded-lg hover:bg-muted/40 transition-colors">
                <div className="text-xs font-medium">Ադմին 2</div>
                <div className="text-[10px] text-muted-foreground">admin2@armroll.am</div>
              </button>
            </div>
          </div>
        </div>

        <div className="text-center mt-6 text-xs text-muted-foreground">
          ARM ROLL ERP · AMD · ՀՀ · v1.0
        </div>
      </div>
    </div>
  );
}
