"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, User, Building2, Plus, Trash2, ShoppingCart } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

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
  const [note, setNote] = useState("");

  // Order items
  const [orderItems, setOrderItems] = useState<Array<{ productId: string; qty: number; parameters: Record<string, string> }>>([
    { productId: "", qty: 1, parameters: { quantity: "1", width: "1000", height: "1500", color: "սպիտակ" } },
  ]);

  const { data: productsData } = useQuery({ queryKey: ["products"], queryFn: fetchProducts, enabled: open });
  const products = productsData?.products ?? [];

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

      // If order items are filled, create an order for this client
      const hasItems = orderItems.some((i) => i.productId);
      if (hasItems) {
        createOrderMutation.mutate({ clientId: data.client.id, items: orderItems });
      } else {
        reset();
        onCreated?.();
        onClose();
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Սխալ"),
  });

  const createOrderMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "failed"); }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Պատվերը ստեղծված է");
      qc.invalidateQueries({ queryKey: ["orders"] });
      reset();
      onCreated?.();
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Պատվերի սխալ"),
  });

  const reset = () => {
    setFirstName(""); setLastName(""); setCompanyName(""); setTaxId("");
    setPhone(""); setEmail(""); setPrimaryAddress(""); setCreditLimit("0"); setNote("");
    setOrderItems([{ productId: "", qty: 1, parameters: { quantity: "1", width: "1000", height: "1500", color: "սպիտակ" } }]);
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

  const updateItem = (idx: number, field: string, value: any) => {
    setOrderItems(orderItems.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };
  const updateParam = (idx: number, key: string, value: any) => {
    setOrderItems(orderItems.map((it, i) => (i === idx ? { ...it, parameters: { ...it.parameters, [key]: String(value) } } : it)));
  };

  return (
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

          {/* Order section */}
          <div className="pt-3 border-t border-hairline">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingCart className="size-4 text-copper" />
              <span className="text-sm font-semibold">Պատվեր (ըստ ցանկության)</span>
            </div>
            <div className="space-y-2">
              {orderItems.map((it, idx) => (
                <div key={idx} className="p-2 border border-hairline space-y-2">
                  <div className="flex items-center gap-2">
                    <Select value={it.productId} onValueChange={(v) => updateItem(idx, "productId", v)}>
                      <SelectTrigger className="h-8 flex-1"><SelectValue placeholder="Ապրանք" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="number" placeholder="Քանակ" value={it.qty} onChange={(e) => updateItem(idx, "qty", Number(e.target.value))} className="h-8 w-20 tabular-nums" />
                    {orderItems.length > 1 && (
                      <Button variant="ghost" size="sm" className="h-8 text-destructive" onClick={() => setOrderItems(orderItems.filter((_, i) => i !== idx))}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input type="number" placeholder="Լայնություն" value={it.parameters.width} onChange={(e) => updateParam(idx, "width", e.target.value)} className="h-8 text-xs tabular-nums" />
                    <Input type="number" placeholder="Բարձրություն" value={it.parameters.height} onChange={(e) => updateParam(idx, "height", e.target.value)} className="h-8 text-xs tabular-nums" />
                    <Input placeholder="Գույն" value={it.parameters.color} onChange={(e) => updateParam(idx, "color", e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full gap-2 border-dashed" onClick={() => setOrderItems([...orderItems, { productId: "", qty: 1, parameters: { quantity: "1", width: "1000", height: "1500", color: "սպիտակ" } }])}>
                <Plus className="size-3.5" /> Ավելացնել ապրանք
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Չեղարկել</Button>
          <Button onClick={submit} disabled={mutation.isPending || createOrderMutation.isPending} className="bg-primary gap-2">
            {mutation.isPending || createOrderMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Ստեղծել{orderItems.some((i) => i.productId) ? " հաճախորդ և պատվեր" : " հաճախորդ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
