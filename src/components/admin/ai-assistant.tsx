"use client";

import { useState } from "react";
import { SectionHeader } from "@/components/shared/primitives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, ShieldAlert, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const MODULES = [
  { key: "ORDER_VALIDATION", label: "Պատվերի ստուգում", tier: "reasoning" },
  { key: "ASK_BUSINESS", label: "Բիզնես հարցեր", tier: "reasoning" },
  { key: "PRICE_MARGIN", label: "Գին/մարժա", tier: "reasoning" },
  { key: "INVENTORY_FORECAST", label: "Պահանջարկի կանխատեսում", tier: "reasoning" },
  { key: "DEBT_ASSISTANT", label: "Պարտքի օգնական", tier: "fast" },
  { key: "EMAIL_ASSISTANT", label: "Էլ․ նամակի օգնական", tier: "fast" },
  { key: "WHATSAPP_ASSISTANT", label: "WhatsApp օգնական", tier: "fast" },
  { key: "OCR_EXTRACTION", label: "Փաստաթղթի OCR", tier: "fast" },
  { key: "VOICE_ORDER", label: "Ձայնային պատվեր", tier: "fast" },
];

export function AIAssistant({ role }: { role: string }) {
  const [module, setModule] = useState("ASK_BUSINESS");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!prompt.trim()) { toast.error("Մուտքագրեք հարցը"); return; }
    setLoading(true); setResult(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ module, prompt, tier: MODULES.find((m) => m.key === module)?.tier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data.proposal);
      if (data.proposal?.status === "REJECTED_BY_GUARDRAIL") {
        toast.warning("Առաջարկը մերժվել է guardrail-ի կողմից");
      } else {
        toast.success("Առաջարկը պատրաստ է դիտարկման");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Սխալ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="AI Օգնական"
        description="9 մոդուլներ — PROPOSAL ռեժիմով, guardrails-ով"
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-2">
        {MODULES.map((m) => (
          <button
            key={m.key}
            onClick={() => setModule(m.key)}
            className={`text-left p-3 border transition-colors ${module === m.key ? "border-primary bg-primary/5" : "border-hairline hover:bg-muted/40"}`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className={`size-3.5 ${module === m.key ? "text-copper" : "text-muted-foreground"}`} />
              <span className="text-sm font-medium">{m.label}</span>
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              {m.tier === "reasoning" ? "deepseek-v4-pro" : "deepseek-v4-flash"}
            </div>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="border-hairline shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Հարց / Հանձնարարություն</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Մոդուլ</Label>
              <Select value={module} onValueChange={setModule}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODULES.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Հարց</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Օրինակ՝ Ինչ խորհուրդ կտաք այս ամսվա ցածր մնացորդների համար?"
                rows={6}
                className="resize-none focus-steel"
              />
            </div>
            <Button onClick={run} disabled={loading} className="gap-2 bg-primary">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Ստեղծել առաջարկ
            </Button>
          </CardContent>
        </Card>

        <Card className="border-hairline shadow-none">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Առաջարկ (PROPOSAL)</CardTitle>
            {result?.status === "REJECTED_BY_GUARDRAIL" && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-status-red bg-status-red/10 px-2 py-0.5">
                <ShieldAlert className="size-3" /> Guardrail
              </span>
            )}
            {result?.status === "PROPOSAL" && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-status-green bg-status-green/10 px-2 py-0.5">
                <CheckCircle2 className="size-3" /> Սպասում է հաստատման
              </span>
            )}
          </CardHeader>
          <CardContent>
            {!result ? (
              <div className="text-sm text-muted-foreground text-center py-12">
                Արդյունքը կհայտնվի այստեղ
              </div>
            ) : (
              <div className="space-y-3">
                {result.model && (
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Sparkles className="size-3" /> Մոդել՝ {result.model}
                  </div>
                )}
                {result.reason && (
                  <div className="text-xs bg-status-red/5 border border-status-red/20 text-status-red p-3 flex items-start gap-2">
                    <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                    <span>{result.reason}</span>
                  </div>
                )}
                <pre className="text-xs bg-muted/40 border border-hairline p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-80 overflow-y-auto">
{JSON.stringify(result.output ?? result, null, 2)}
                </pre>
                {result.proposedAction && (
                  <div className="text-xs">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Առաջարկվող գործողություն</div>
                    <div className="font-mono bg-primary/5 border border-hairline p-2">{result.proposedAction.type}</div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-hairline shadow-none bg-muted/20">
        <CardContent className="p-4 flex items-start gap-3">
          <ShieldAlert className="size-4 text-copper shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Guardrail-ներ։</strong> AI-ը կարող է միայն առաջարկներ անել (PROPOSAL)։
            Արգելված մուտացիաներ՝ վճարումներ, պարտքեր, գույքագրում, գներ, զեղչեր, հարկային կանոններ, ջարդումային ջնջում։
            Բոլոր առաջարկներն անցնում են schema validation → RBAC → business rule → օգտատիրոջ հաստատում → deterministic գործողություն։
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
