"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, User, Building2, Zap } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { QuickFillOrderDialog } from "./orders-module";

async function fetchProducts() {
  const res = await fetch("/api/products");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export function ClientCreateDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: () => void }) {
  const [type, setType] = useState<"INDIVIDUAL" | "COMPANY">("INDIVIDUAL");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [primaryAddress, setPrimaryAddress] = useState("");
  const [preferredChannel, setPreferredChannel] = useState("whatsapp");
  const [creditLimit, setCreditLimit] = useState("0");

  // After client creation, optionally open Quick-Fill order dialog
  const [quickFillForClientId, setQuickFillForClientId] = useState<string | null>(null);
  const [quickFillForClientName, setQuickFillForClientName] = useState<string>("");

  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/clients", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success("Հաճախորդը ստեղծված է");
      qc.invalidateQueries({ queryKey: ["clients"] });
      // Offer to register an order immediately
      setQuickFillForClientId(data.client.id);
      setQuickFillForClientName(
        data.client.type === "COMPANY" ? data.client.companyName : `${data.client.firstName} ${data.client.lastName}`
      );
      reset();
    },
    onError: (e: any) => toast.error(e?.message ?? "Սխալ"),
  });

  const reset = () => {
    setFirstName(""); setLastName(""); setCompanyName(""); setTaxId("");
    setPhone(""); setEmail(""); setPrimaryAddress(""); setCreditLimit("0");
  };

  const submit = () => {
    if (!phone) { toast.error("Հեռախոսը պարտադիր է"); return; }
    if (type === "INDIVIDUAL" && (!firstName || !lastName)) { toast.error("Անուն և Ազգանունը պարտադիր են"); return; }
    if (type === "COMPANY" && !companyName) { toast.error("Ընկերության անվանումը պարտադիր է"); return; }
    mutation.mutate({
      type,
      firstName, lastName,
      companyName: type === "COMPANY" ? companyName : undefined,
      taxId: type === "COMPANY" ? taxId : undefined,
      phone, email, primaryAddress,
      preferredChannel,
      creditLimit: Number(creditLimit) || 0,
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Նոր հաճախորդ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Type toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setType("INDIVIDUAL")}
                className={`p-3 border flex items-center gap-3 transition-colors ${type === "INDIVIDUAL" ? "border-primary bg-primary/5" : "border-hairline hover:bg-muted/40"}`}
              >
                <User className={`size-5 ${type === "INDIVIDUAL" ? "text-copper" : "text-muted-foreground"}`} />
                <div className="text-left">
                  <div className="text-sm font-medium">Ֆիզիկական անձ</div>
                  <div className="text-xs text-muted-foreground">Անհատ հաճախորդ</div>
                </div>
              </button>
              <button
                onClick={() => setType("COMPANY")}
                className={`p-3 border flex items-center gap-3 transition-colors ${type === "COMPANY" ? "border-primary bg-primary/5" : "border-hairline hover:bg-muted/40"}`}
              >
                <Building2 className={`size-5 ${type === "COMPANY" ? "text-copper" : "text-muted-foreground"}`} />
                <div className="text-left">
                  <div className="text-sm font-medium">Իրավաբանական անձ</div>
                  <div className="text-xs text-muted-foreground">Ընկերություն</div>
                </div>
              </button>
            </div>

            {type === "INDIVIDUAL" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Անուն *</Label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="focus-steel" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Ազգանուն *</Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="focus-steel" />
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Ընկերության անվանում *</Label>
                  <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="focus-steel" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">ՀՎՀՀ (հարկային)</Label>
                    <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} className="focus-steel tabular-nums" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Վարկային սահմանաչափ (դր)</Label>
                    <Input type="number" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} className="focus-steel tabular-nums" />
                  </div>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Հեռախոս *</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+374 99 123456" className="focus-steel tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Էլ․ հասցե</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="focus-steel" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Հասցե</Label>
              <Textarea value={primaryAddress} onChange={(e) => setPrimaryAddress(e.target.value)} rows={2} className="focus-steel resize-none" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Նախընտրելի կապի միջոց</Label>
              <Select value={preferredChannel} onValueChange={setPreferredChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Էլ․ փոստ</SelectItem>
                  <SelectItem value="phone">Հեռախոս</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Չեղարկել</Button>
            <Button onClick={submit} disabled={mutation.isPending} className="bg-primary gap-2">
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Ստեղծել հաճախորդ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* After client is created — offer to register order */}
      {quickFillForClientId && (
        <QuickFillOrderDialog
          onClose={() => {
            setQuickFillForClientId(null);
            onCreated?.();
            onClose();
          }}
          onCreated={() => {
            setQuickFillForClientId(null);
            onCreated?.();
            onClose();
          }}
        />
      )}
    </>
  );
}
