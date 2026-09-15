"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";

interface TemplateEditorProps {
  template: any;
  onClose: () => void;
}

export function TemplateEditor({ template, onClose }: TemplateEditorProps) {
  const qc = useQueryClient();

  const patchMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/documents/${template.id}`, { 
        method: "PATCH", 
        headers: { "content-type": "application/json" }, 
        body: JSON.stringify(payload) 
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "failed"); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Ձևաթուղթը թարմացվել է");
    },
    onError: (e: any) => toast.error(e?.message ?? "Սխալ"),
  });

  if (!template) {
    return (
      <Sheet open onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="sr-only">
            <SheetTitle>Ձևաթղթի խմբագրիչ</SheetTitle>
          </SheetHeader>
          <div className="p-8 text-center text-muted-foreground text-sm">
            <Loader2 className="size-6 animate-spin mx-auto mb-2" />
            Բեռնվում է…
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const t = template;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="p-4 border-b border-hairline space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <SheetTitle className="text-base">{t.name || t.type}</SheetTitle>
              <div className="text-xs text-muted-foreground mt-0.5">
                {t.type} · v{t.version}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="h-7 text-xs gap-1.5" 
                onClick={() => patchMutation.mutate({ op: "toggle_active", active: !t.active })}
              >
                {t.active ? <><EyeOff className="size-3.5" /> Պասիվացնել</> : <><Eye className="size-3.5" /> Ակտիվացնել</>}
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Անվանում</Label>
              <Input 
                value={t.name || ""} 
                onChange={(e) => patchMutation.mutate({ name: e.target.value })}
                disabled={patchMutation.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Տիպ</Label>
              <Input value={t.type} disabled className="bg-muted/50" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Շաբլոն</Label>
            <Textarea 
              value={t.bodyTemplate || ""} 
              onChange={(e) => patchMutation.mutate({ bodyTemplate: e.target.value })}
              disabled={patchMutation.isPending}
              className="min-h-[200px] font-mono text-xs"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-hairline">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">Ակտիվ</div>
              <div className="text-xs text-muted-foreground">Ձևաթուղթը հասանելի է օգտագործման համար</div>
            </div>
            <Switch
              checked={t.active}
              onCheckedChange={(checked) => patchMutation.mutate({ op: "toggle_active", active: checked })}
              disabled={patchMutation.isPending}
            />
          </div>
        </div>

        {patchMutation.isPending && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="size-6 animate-spin mx-auto mb-2" />
              <div className="text-sm text-muted-foreground">Պահպանվում է…</div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
