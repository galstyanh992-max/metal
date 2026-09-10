"use client";

import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight, ArrowRightLeft, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Branch = { id: string; name: string; code: string };
type InventoryItem = {
  id: string;
  name: string;
  sku: string;
  state: { onHand: number; available: number };
  byBranch?: Array<{ branchId: string; branchName: string; onHand: number; available: number }>;
};

export function TransferDialog({
  branches,
  inventory,
  onClose,
  onSaved,
}: {
  branches: Branch[];
  inventory: InventoryItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fromBranchId, setFromBranchId] = useState<string>("");
  const [toBranchId, setToBranchId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [autoConfirm, setAutoConfirm] = useState(true);

  // Available products in fromBranch (with onHand > 0)
  const availableInBranch = useMemo(() => {
    if (!fromBranchId) return [];
    return inventory
      .filter((p) => {
        const bs = p.byBranch?.find((b) => b.branchId === fromBranchId);
        return bs && bs.onHand > 0;
      })
      .filter((p) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      });
  }, [fromBranchId, inventory, search]);

  const selectedItems = useMemo(() => {
    return Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, qty]) => {
        const p = inventory.find((x) => x.id === productId);
        return p ? { productId, qty, name: p.name, sku: p.sku } : null;
      })
      .filter(Boolean);
  }, [quantities, inventory]);

  const fromBranch = branches.find((b) => b.id === fromBranchId);
  const toBranch = branches.find((b) => b.id === toBranchId);
  const sameBranch = fromBranchId && toBranchId && fromBranchId === toBranchId;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!fromBranchId || !toBranchId) throw new Error("Ընտրեք մասնաճյուղերը");
      if (sameBranch) throw new Error("Հնարավոր չէ փոխանցել նույն մասնաճյուղին");
      const items = Object.entries(quantities)
        .filter(([_, qty]) => qty > 0)
        .map(([productId, qty]) => ({ productId, qty }));
      if (items.length === 0) throw new Error("Լցրեք քանակը առնվազն մեկ ապրանքի համար");

      const res = await fetch("/api/inventory/transfer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fromBranchId, toBranchId, items, note, autoConfirm }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw Object.assign(new Error(e.error ?? "failed"), { stockError: e.stockError, details: e.details });
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Տեղափոխություն ${data.transfer.number} ստեղծված է`);
      onSaved();
    },
    onError: (e: any) => {
      if (e?.stockError && e?.details) {
        toast.error(`Պահեստի սխալ՝ ${e.details.length} ապրանք`);
      } else {
        toast.error(e?.message ?? "Սխալ");
      }
    },
  });

  const submit = () => mutation.mutate();

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0 max-sm:w-[calc(100%-1rem)] max-sm:max-h-[calc(100dvh-1rem)]">
        <DialogHeader className="px-5 py-4 border-b border-hairline bg-card shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="size-5 text-primary" />
            Տեղափոխել ապրանքներ մասնաճյուղերի միջև
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 sm:p-5">
          {/* Branch selectors */}
          <div className="grid grid-cols-1 gap-3 items-end sm:grid-cols-[1fr_auto_1fr]">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Որ մասնաճյուղից *</Label>
              <Select value={fromBranchId} onValueChange={(v) => { setFromBranchId(v); setQuantities({}); }}>
                <SelectTrigger><SelectValue placeholder="Ընտրեք" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="hidden pb-2 sm:block">
              <ArrowRight className="size-5 text-primary" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Որ մասնաճյուղ *</Label>
              <Select value={toBranchId} onValueChange={setToBranchId}>
                <SelectTrigger><SelectValue placeholder="Ընտրեք" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id} disabled={b.id === fromBranchId}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {sameBranch && (
            <div className="p-2 border border-status-red/30 bg-status-red/5 text-xs text-status-red flex items-center gap-2">
              <AlertTriangle className="size-4" />
              Հնարավոր չէ փոխանցել նույն մասնաճյուղին
            </div>
          )}

          {fromBranchId && toBranchId && !sameBranch && (
            <div className="p-3 border border-hairline bg-muted/20 text-sm">
              <span className="text-muted-foreground">Տեղափոխություն՝ </span>
              <strong>{fromBranch?.name}</strong>
              <ArrowRight className="inline size-3 mx-2" />
              <strong>{toBranch?.name}</strong>
            </div>
          )}

          {/* Search */}
          {fromBranchId && (
            <div className="relative">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Որոնում՝ անուն, SKU…"
                className="focus-steel"
              />
            </div>
          )}

          {/* Products table */}
          {fromBranchId && availableInBranch.length > 0 && (
            <div className="border border-hairline rounded-lg max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/30">
                  <tr className="border-b border-hairline">
                    <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-2">Ապրանք</th>
                    <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-2 w-24">Մնացորդ</th>
                    <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-2 w-32">Քանակ</th>
                  </tr>
                </thead>
                <tbody>
                  {availableInBranch.map((p) => {
                    const bs = p.byBranch?.find((b) => b.branchId === fromBranchId);
                    const onHand = bs?.onHand ?? 0;
                    const qty = quantities[p.id] ?? 0;
                    return (
                      <tr key={p.id} className="border-b border-hairline hover:bg-muted/20">
                        <td className="px-3 py-2">
                          <div className="font-medium">{p.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{p.sku}</div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{onHand}</td>
                        <td className="px-2 py-1.5">
                          <Input
                            type="number"
                            min={0}
                            max={onHand}
                            value={qty || ""}
                            onChange={(e) => {
                              const v = Number(e.target.value) || 0;
                              setQuantities({ ...quantities, [p.id]: Math.min(v, onHand) });
                            }}
                            placeholder="0"
                            className={`h-8 text-right tabular-nums px-2 text-xs focus-steel ${
                              qty > onHand ? "border-status-red" : ""
                            }`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {fromBranchId && availableInBranch.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {search ? "Որոնման արդյունքներ չկան" : "Ընտրված մասնաճյուղում ապրանքներ չկան"}
            </div>
          )}

          {/* Note + auto-confirm */}
          {fromBranchId && availableInBranch.length > 0 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Նշում (ոչ պարտադիր)</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Տեղափոխության պատճառը..." className="focus-steel" />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={autoConfirm} onChange={(e) => setAutoConfirm(e.target.checked)} className="size-4 accent-primary" />
                <span>Ավտոմատ հաստատել տեղափոխությունը (գումարները անմիջապես կկատարվեն)</span>
              </label>
            </div>
          )}
        </div>

        <DialogFooter className="px-5 py-3 border-t border-hairline bg-card shrink-0 flex items-center justify-between gap-3">
          <div className="text-sm">
            {selectedItems.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {selectedItems.length} ապրանք · ընդհանուր {selectedItems.reduce((s, x) => s + (x?.qty ?? 0), 0)} հատ
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>Չեղարկել</Button>
            <Button
              onClick={submit}
              disabled={mutation.isPending || !fromBranchId || !toBranchId || sameBranch || selectedItems.length === 0}
              className="bg-primary gap-2"
            >
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              <ArrowRightLeft className="size-4" />
              Ստեղծել տեղափոխություն
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
