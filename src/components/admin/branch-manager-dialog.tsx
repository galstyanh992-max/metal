"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Branch = {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  _count?: { inventoryMovements: number; inventorySnapshots: number; transfersFrom: number; transfersTo: number };
};

type BranchPayload = { name: string; address: string; phone: string };

async function saveBranch(id: string | null, payload: BranchPayload) {
  const response = await fetch(id ? `/api/branches/${id}` : "/api/branches", {
    method: id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Չհաջողվեց պահպանել պահեստը");
  return data;
}

async function deleteBranch(id: string) {
  const response = await fetch(`/api/branches/${id}`, { method: "DELETE" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Չհաջողվեց ջնջել պահեստը");
  return data;
}

export function BranchManagerDialog({
  open,
  onOpenChange,
  branches,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: Branch[];
  onDeleted?: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState<BranchPayload>({ name: "", address: "", phone: "" });
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);

  const resetForm = () => {
    setEditing(null);
    setForm({ name: "", address: "", phone: "" });
  };

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["branches"] });
    void queryClient.invalidateQueries({ queryKey: ["inventory"] });
  };

  const saveMutation = useMutation({
    mutationFn: () => saveBranch(editing?.id ?? null, form),
    onSuccess: () => {
      toast.success(editing ? "Պահեստի տվյալները թարմացվեցին" : "Պահեստը ստեղծվեց");
      refresh();
      resetForm();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (branch: Branch) => deleteBranch(branch.id),
    onSuccess: (_result, branch) => {
      toast.success("Պահեստը ջնջվեց");
      onDeleted?.(branch.id);
      refresh();
      setDeleteTarget(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const startEditing = (branch: Branch) => {
    setEditing(branch);
    setForm({ name: branch.name, address: branch.address ?? "", phone: branch.phone ?? "" });
  };

  const references = (branch: Branch) => {
    const count = branch._count;
    return (count?.inventoryMovements ?? 0) + (count?.inventorySnapshots ?? 0) + (count?.transfersFrom ?? 0) + (count?.transfersTo ?? 0);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => { onOpenChange(nextOpen); if (!nextOpen) resetForm(); }}>
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden max-sm:w-[calc(100%-1rem)]">
          <DialogHeader className="border-b px-4 py-4 sm:px-6">
            <DialogTitle>Պահեստների կառավարում</DialogTitle>
            <DialogDescription>Ստեղծեք պահեստ, փոխեք նրա անունը կամ ջնջեք դեռ չօգտագործված պահեստը։</DialogDescription>
          </DialogHeader>

          <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto p-4 space-y-5 sm:p-6">
            <Card className="border-primary/20 bg-primary/[0.03] shadow-none">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">{editing ? "Փոխել պահեստի տվյալները" : "Նոր պահեստ"}</div>
                  {editing && <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={resetForm}><X className="size-3.5" /> Չեղարկել</Button>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="branch-name">Անուն *</Label>
                    <Input id="branch-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Օր.՝ Արաբկիրի պահեստ" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="branch-phone">Հեռախոս</Label>
                    <Input id="branch-phone" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+374 …" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="branch-address">Հասցե</Label>
                  <Input id="branch-address" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} placeholder="Քաղաք, փողոց, շենք" />
                </div>
                <Button type="button" className="w-full gap-2 sm:w-auto" disabled={!form.name.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                  {saveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : editing ? <Pencil className="size-4" /> : <Plus className="size-4" />}
                  {editing ? "Պահպանել փոփոխությունները" : "Ավելացնել պահեստ"}
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Գործող պահեստներ · {branches.length}</div>
              {branches.map((branch) => {
                const used = references(branch);
                const canDelete = branch.code !== "main" && used === 0;
                return (
                  <Card key={branch.id} className="shadow-none">
                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Building2 className="size-4" /></div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{branch.name}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">{branch.address || branch.phone || (branch.code === "main" ? "Հիմնական պահեստ" : "Առանց հասցեի")}</div>
                          {used > 0 && <div className="mt-1 text-[11px] text-muted-foreground">Պատմություն՝ {used} գրառում · ջնջումը հասանելի չէ</div>}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => startEditing(branch)}><Pencil className="size-3.5" /> Փոխել</Button>
                        <Button type="button" size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive" disabled={!canDelete} title={!canDelete ? (branch.code === "main" ? "Հիմնական պահեստը չի կարող ջնջվել" : "Պահեստն արդեն օգտագործվել է") : undefined} onClick={() => setDeleteTarget(branch)}><Trash2 className="size-3.5" /> Ջնջել</Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ջնջե՞լ «{deleteTarget?.name}» պահեստը</AlertDialogTitle>
            <AlertDialogDescription>Այս գործողությունը վերջնական է։ Ջնջվում են միայն այն պահեստները, որոնք չունեն մնացորդների կամ տեղափոխությունների պատմություն։</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Չեղարկել</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteMutation.isPending} onClick={(event) => { event.preventDefault(); if (deleteTarget) deleteMutation.mutate(deleteTarget); }}>
              {deleteMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />} Ջնջել պահեստը
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
