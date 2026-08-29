"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Lock, Factory } from "lucide-react";

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
      // Force page reload to pick up the new session
      window.location.reload();
    }
  };

  const fillDemo = (em: string, pw: string) => {
    setEmail(em);
    setPassword(pw);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 grid lg:grid-cols-2">
        {/* Brand panel */}
        <div className="hidden lg:flex flex-col justify-between p-12 bg-primary text-primary-foreground relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: "repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 1px, transparent 12px)"
          }} />
          <div className="relative">
            <div className="flex items-center gap-3">
              <img src="/logo.jpeg" alt="Arm Roll" className="size-10 object-contain" />
              <div>
                <div className="text-lg font-semibold tracking-tight">ARM ROLL</div>
                <div className="text-xs text-primary-foreground/60 tracking-widest uppercase">ERP / CRM — Armenia</div>
              </div>
            </div>
          </div>
          <div className="relative space-y-4">
            <h1 className="text-3xl font-semibold leading-tight">
              Արտադրության և առևտրի<br/>
              <span className="text-copper">ճշգրիտ կառավարում</span>
            </h1>
            <p className="text-primary-foreground/70 text-sm leading-relaxed max-w-md">
              Հաճախորդներ, պատվերներ, պահեստ, ֆինանսներ, հարկեր և փաստաթղթեր՝ մեկ համակարգում։ Հայաստանյան արդյունաբերական ճշգրտությամբ։
            </p>
          </div>
          <div className="relative text-xs text-primary-foreground/40 flex justify-between">
            <span>v0.1 · ARMENIAN INDUSTRIAL PRECISION</span>
            <span>AMD · ՀՀ</span>
          </div>
        </div>

        {/* Form panel */}
        <div className="flex items-center justify-center p-6 sm:p-12">
          <Card className="w-full max-w-sm border-hairline shadow-none">
            <CardHeader className="space-y-3">
              <div className="lg:hidden flex items-center gap-2">
                <img src="/logo.jpeg" alt="Arm Roll" className="size-8 object-contain" />
                <span className="font-semibold">ARM ROLL ERP</span>
              </div>
              <CardTitle className="text-xl">Մուտք համակարգ</CardTitle>
              <p className="text-sm text-muted-foreground">Մուտքագրեք ձեր տվյալները</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs uppercase tracking-wide text-muted-foreground">Էլ․ հասցե</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus className="focus-steel" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs uppercase tracking-wide text-muted-foreground">Գաղտնաբառ</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="focus-steel" />
                </div>
                {error && <div className="text-xs text-destructive bg-destructive/5 border border-destructive/20 px-3 py-2">{error}</div>}
                <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90">
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
                  Մուտք
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
