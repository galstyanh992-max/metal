"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Loader2, FolderTree, X, Check } from "lucide-react";
import { toast } from "sonner";

async function fetchCategories() {
  const res = await fetch("/api/categories");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

async function fetchProducts() {
  const res = await fetch("/api/products");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export function CategoryManagerDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: catData } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: prodData } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });

  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedCatId, setSelectedCatId] = useState<string>("");
  const [addingProductId, setAddingProductId] = useState("");

  const categories = catData?.categories ?? [];
  const products = prodData?.products ?? [];

  const selectedCat = categories.find((c: any) => c.id === selectedCatId);
  const productsInCategory = selectedCat
    ? products.filter((p: any) => p.categoryId === selectedCat.id)
    : [];
  const productsWithoutCategory = products.filter((p: any) => !p.categoryId);

  // Create category
  const createMut = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "failed"); }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Կատեգորիան ստեղծված է");
      setNewName("");
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Սխալ"),
  });

  // Rename category
  const renameMut = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "failed"); }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Կատեգորիան վերանվանված է");
      setEditId(null);
      setEditName("");
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Սխալ"),
  });

  // Delete category
  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data.hard ? "Կատեգորիան ջնջված է" : `Արխիվացված է · ${data.reason ?? ""}`);
      setDeleteId(null);
      if (selectedCatId === deleteId) setSelectedCatId("");
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Սխալ"),
  });

  // Assign product to category
  const assignMut = useMutation({
    mutationFn: async ({ productId, categoryId }: { productId: string; categoryId: string | null }) => {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ categoryId }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "failed"); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Սխալ"),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-hairline bg-card shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FolderTree className="size-5 text-primary" />
            Կատեգորիաների կառավարում
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Ստեղծեք, վերանվանեք և ջնջեք կատեգորիաներ · Կապեք ապրանքները կատեգորիաների հետ
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Create new category */}
          <div className="border border-hairline bg-muted/20 p-3 rounded-lg">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
              Նոր կատեգորիա
            </Label>
            <div className="flex items-center gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Օրինակ՝ Մետաղական ջալուզիներ"
                className="focus-steel"
              />
              <Button
                onClick={() => newName.trim() && createMut.mutate(newName.trim())}
                disabled={createMut.isPending || !newName.trim()}
                className="bg-primary gap-2 shrink-0"
              >
                {createMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Ստեղծել
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Categories list */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <FolderTree className="size-4 text-primary" />
                Կատեգորիաներ ({categories.length})
              </h3>
              <div className="border border-hairline rounded-lg divide-y divide-hairline max-h-96 overflow-y-auto">
                {categories.map((c: any) => (
                  <div
                    key={c.id}
                    className={`flex items-center gap-2 px-3 py-2.5 hover:bg-muted/30 transition-colors ${
                      selectedCatId === c.id ? "bg-primary/5" : ""
                    }`}
                  >
                    <button
                      onClick={() => setSelectedCatId(c.id)}
                      className="flex-1 text-left text-sm font-medium truncate"
                    >
                      {c.name}
                    </button>
                    <Badge variant="outline" className="text-[10px] border-hairline shrink-0">
                      {c._count?.products ?? 0} ապր.
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 shrink-0"
                      onClick={() => { setEditId(c.id); setEditName(c.name); }}
                      title="Վերանվանել"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 shrink-0 text-destructive"
                      onClick={() => setDeleteId(c.id)}
                      title="Ջնջել"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
                {categories.length === 0 && (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    Կատեգորիաներ չկան
                  </div>
                )}
              </div>
            </div>

            {/* Selected category: products management */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                {selectedCat ? (
                  <>
                    <FolderTree className="size-4 text-primary" />
                    {selectedCat.name} — ապրանքներ
                  </>
                ) : (
                  "Ընտրեք կատեգորիան"
                )}
              </h3>

              {selectedCat ? (
                <div className="space-y-3">
                  {/* Add product to category */}
                  <div className="border border-dashed border-hairline p-2.5 rounded-lg">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
                      Ավելացնել ապրանք
                    </Label>
                    <div className="flex items-center gap-2">
                      <Select
                        value={addingProductId}
                        onValueChange={(v) => {
                          if (v) {
                            assignMut.mutate({ productId: v, categoryId: selectedCat.id });
                            setAddingProductId("");
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Ընտրեք ապրանք" />
                        </SelectTrigger>
                        <SelectContent>
                          {productsWithoutCategory.map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} <span className="text-muted-foreground">({p.sku})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {productsWithoutCategory.length === 0 && (
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        Բոլոր ապրանքներն արդեն կապված են կատեգորիաների հետ
                      </p>
                    )}
                  </div>

                  {/* Products in this category */}
                  <div className="border border-hairline rounded-lg divide-y divide-hairline max-h-72 overflow-y-auto">
                    {productsInCategory.map((p: any) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{p.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{p.sku}</div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 shrink-0 text-destructive"
                          onClick={() => assignMut.mutate({ productId: p.id, categoryId: null })}
                          title="Հանել կատեգորիայից"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                    {productsInCategory.length === 0 && (
                      <div className="p-6 text-center text-xs text-muted-foreground">
                        Այս կատեգորիայում ապրանքներ չկան
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-hairline rounded-lg p-8 text-center text-sm text-muted-foreground">
                  Ձախից ընտրեք կատեգորիան՝ դրա ապրանքները կառավարելու համար
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-3 border-t border-hairline bg-card shrink-0">
          <Button onClick={onClose} variant="outline">Փակել</Button>
        </DialogFooter>
      </DialogContent>

      {/* Rename sub-dialog */}
      {editId && (
        <Dialog open onOpenChange={(o) => !o && setEditId(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="size-4 text-primary" />
                Վերանվանել կատեգորիան
              </DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
                className="focus-steel"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditId(null)}>Չեղարկել</Button>
              <Button
                onClick={() => editName.trim() && renameMut.mutate({ id: editId, name: editName.trim() })}
                disabled={renameMut.isPending || !editName.trim()}
                className="bg-primary gap-2"
              >
                {renameMut.isPending && <Loader2 className="size-4 animate-spin" />}
                <Check className="size-4" />
                Պահպանել
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirmation sub-dialog */}
      {deleteId && (
        <Dialog open onOpenChange={(o) => !o && setDeleteId(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="size-4" />
                Ջնջել կատեգորիան
              </DialogTitle>
            </DialogHeader>
            <div className="py-2 text-sm space-y-2">
              <p>Դուք պատրաստվում եք ջնջել՝</p>
              <div className="p-3 border border-hairline bg-muted/30">
                <div className="font-medium">
                  {categories.find((c: any) => c.id === deleteId)?.name}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {categories.find((c: any) => c.id === deleteId)?._count?.products ?? 0} ապրանք կապված է
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Եթե կատեգորիան ունի ապրանքներ, դրանք կապակապակցվեն (categoryId=null), իսկ կատեգորիան կարխիվացվի։
                Հակառակ դեպքում կջնջվի վերջնականապես։
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)}>Չեղարկել</Button>
              <Button
                variant="destructive"
                onClick={() => deleteMut.mutate(deleteId)}
                disabled={deleteMut.isPending}
                className="gap-2"
              >
                {deleteMut.isPending && <Loader2 className="size-4 animate-spin" />}
                <Trash2 className="size-4" />
                Ջնջել
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
