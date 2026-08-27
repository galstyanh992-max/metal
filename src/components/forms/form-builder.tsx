"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SectionHeader, EmptyState, KpiCard } from "@/components/shared/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, FileText, Layers, GripVertical, Trash2, Copy, Eye, EyeOff, Loader2, Settings2, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

async function fetchTemplates() {
  const res = await fetch("/api/forms");
  if (!res.ok) throw new Error("failed");
  return res.json();
}

async function fetchTemplate(id: string) {
  const res = await fetch(`/api/forms/${id}`);
  if (!res.ok) throw new Error("failed");
  return res.json();
}

const ENTITY_LABELS: Record<string, string> = {
  ORDER_ITEM: "Պատվերի տարր",
  PRODUCT: "Ապրանք",
  CLIENT: "Հաճախորդ",
};

const FIELD_TYPE_LABELS: Record<string, string> = {
  TEXT: "Տեքստ",
  TEXTAREA: "Մեծ տեքստ",
  NUMBER: "Թիվ",
  DECIMAL: "Տասնորդական",
  DIMENSION: "Չափ (մմ)",
  QUANTITY: "Քանակ",
  MONEY: "Գումար",
  BOOLEAN: "Բուլյան",
  DATE: "Ամսաթիվ",
  SELECT: "Ընտրություն",
  MULTISELECT: "Բազմաընտրություն",
  COLOR: "Գույն",
  PHONE: "Հեռախոս",
  EMAIL: "Էլ․ փոստ",
  ADDRESS: "Հասցե",
  PHOTO: "Լուսանկար",
  FILE: "Ֆայլ",
};

const FIELD_TYPE_ICONS: Record<string, any> = {
  TEXT: "Aa", TEXTAREA: "¶", NUMBER: "#", DECIMAL: "#.#", DIMENSION: "↔", QUANTITY: "×",
  MONEY: "֏", BOOLEAN: "☑", DATE: "📅", SELECT: "▾", MULTISELECT: "☰", COLOR: "●",
  PHONE: "☎", EMAIL: "@", ADDRESS: "⌂", PHOTO: "📷", FILE: "📎",
};

export function FormBuilderModule() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["forms"], queryFn: fetchTemplates });
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const templates = data?.templates ?? [];
  const activeCount = templates.filter((t: any) => t.active).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Դինամիկ ձևեր"
        description="Admin-ի կողմից ստեղծվող ձևեր և դաշտեր"
        action={<Button size="sm" className="gap-2 bg-primary" onClick={() => setCreateOpen(true)}><Plus className="size-4" /> Նոր ձև</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Ընդհանուր ձևեր" value={String(templates.length)} icon={FileText} />
        <KpiCard label="Ակտիվ" value={String(activeCount)} icon={Eye} />
        <KpiCard label="Խմբեր" value={String(templates.reduce((s: number, t: any) => s + (t.groups?.length ?? 0), 0))} icon={Layers} />
        <KpiCard label="Դաշտեր" value={String(templates.reduce((s: number, t: any) => s + (t.groups?.reduce((ss: number, g: any) => ss + (g.fields?.length ?? 0), 0) ?? 0), 0))} icon={Settings2} />
      </div>

      <Card className="border-hairline shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-hairline">
                <TableHead className="text-xs uppercase">Անվանում</TableHead>
                <TableHead className="text-xs uppercase">Տիպ</TableHead>
                <TableHead className="text-xs uppercase text-right">Խմբեր</TableHead>
                <TableHead className="text-xs uppercase text-right">Դաշտեր</TableHead>
                <TableHead className="text-xs uppercase">Վերսիա</TableHead>
                <TableHead className="text-xs uppercase">Կարգավիճակ</TableHead>
                <TableHead className="text-xs uppercase text-right">Գործողություն</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t: any) => (
                <TableRow key={t.id} className="border-hairline hover:bg-muted/40 cursor-pointer" onClick={() => setEditId(t.id)}>
                  <TableCell className="text-sm font-medium">{t.name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{ENTITY_LABELS[t.entityType] ?? t.entityType}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{t.groups?.length ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.groups?.reduce((s: number, g: any) => s + (g.fields?.length ?? 0), 0) ?? 0}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">v{t.version}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] uppercase ${t.active ? "bg-status-green/15 text-status-green border-status-green/30" : "bg-muted text-muted-foreground"}`}>
                      {t.active ? "Ակտիվ" : "Պասիվ"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5">
                      <Settings2 className="size-3.5" /> Խմբագրել
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {templates.length === 0 && !isLoading && (
                <TableRow><TableCell colSpan={7}><EmptyState title="Ձևեր չկան" description="Ստեղծեք նոր ձև՝ դինամիկ դաշտերով" /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {createOpen && <CreateTemplateDialog onClose={() => setCreateOpen(false)} onCreated={(id) => { setCreateOpen(false); setEditId(id); }} />}
      {editId && <TemplateEditorSheet templateId={editId} onClose={() => setEditId(null)} />}
    </div>
  );
}

function CreateTemplateDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [entityType, setEntityType] = useState("ORDER_ITEM");

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/forms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "failed"); }
      return res.json();
    },
    onSuccess: (data) => { toast.success("Ձևը ստեղծված է"); onCreated(data.template.id); },
    onError: (e: any) => toast.error(e?.message ?? "Սխալ"),
  });

  const submit = () => {
    if (!name) { toast.error("Մուտքագրեք անվանումը"); return; }
    mutation.mutate({ name, entityType });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Նոր ձև</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Անվանում *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Օրինակ՝ Ջալուզիի պատվերի ձև" className="focus-steel" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Տիպ</Label>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ORDER_ITEM">Պատվերի տարր</SelectItem>
                <SelectItem value="PRODUCT">Ապրանք</SelectItem>
                <SelectItem value="CLIENT">Հաճախորդ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Չեղարկել</Button>
          <Button onClick={submit} disabled={mutation.isPending} className="bg-primary gap-2">
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Ստեղծել
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateEditorSheet({ templateId, onClose }: { templateId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["form", templateId], queryFn: () => fetchTemplate(templateId) });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [addFieldFor, setAddFieldFor] = useState<string | null>(null);

  const template = data?.template;

  const patchMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/forms/${templateId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "failed"); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["form", templateId] });
      qc.invalidateQueries({ queryKey: ["forms"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Սխալ"),
  });

  const toggleGroup = (gid: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(gid)) next.delete(gid);
      else next.add(gid);
      return next;
    });
  };

  const addGroup = () => {
    const label = prompt("Խմբի անվանունը:");
    if (label) patchMutation.mutate({ op: "add_group", label });
  };

  if (isLoading || !template) {
    return (
      <Sheet open onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <div className="p-8 text-center text-muted-foreground text-sm">Բեռնվում է…</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="p-4 border-b border-hairline space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <SheetTitle className="text-base">{template.name}</SheetTitle>
              <div className="text-xs text-muted-foreground mt-0.5">
                {ENTITY_LABELS[template.entityType]} · v{template.version} · {template.groups?.length ?? 0} խումբ
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => patchMutation.mutate({ op: "toggle_active", active: !template.active })}>
                {template.active ? <><EyeOff className="size-3.5" /> Պասիվացնել</> : <><Eye className="size-3.5" /> Ակտիվացնել</>}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => { if (confirm("Ստեղծել նոր վերսիա՞")) patchMutation.mutate({ op: "duplicate" }); }}>
                <Copy className="size-3.5" /> Նոր վերսիա
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="p-4 space-y-3">
          {template.groups?.map((group: any) => {
            const isExpanded = expandedGroups.has(group.id) || group.fields?.length === 0;
            return (
              <div key={group.id} className="border border-hairline">
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/40"
                  onClick={() => toggleGroup(group.id)}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                    <GripVertical className="size-4 text-muted-foreground/40" />
                    <span className="text-sm font-medium">{group.label}</span>
                    <Badge variant="outline" className="text-[10px]">{group.fields?.length ?? 0} դաշտ</Badge>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); setAddFieldFor(group.id); }}>
                    <Plus className="size-3.5" /> Դաշտ
                  </Button>
                </div>
                {isExpanded && group.fields?.length > 0 && (
                  <div className="border-t border-hairline divide-y divide-hairline">
                    {group.fields.map((field: any) => (
                      <div key={field.id} className="flex items-center gap-3 p-2.5 hover:bg-muted/30 group">
                        <GripVertical className="size-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="size-7 bg-muted flex items-center justify-center text-[10px] font-mono font-medium shrink-0">
                          {FIELD_TYPE_ICONS[field.type] ?? "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {field.label}
                            {field.required && <span className="text-destructive ml-1">*</span>}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {field.key} · {FIELD_TYPE_LABELS[field.type] ?? field.type}
                            {field.archivedAt && <span className="text-status-orange ml-1">· արխիվացված</span>}
                          </div>
                        </div>
                        {field.conditionExpr && (
                          <Badge variant="outline" className="text-[9px] bg-copper/10 text-copper border-copper/30">պայման</Badge>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            if (confirm("Ջնջե՞լ դաշտը")) patchMutation.mutate({ op: "delete_field", fieldId: field.id });
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {isExpanded && (!group.fields || group.fields.length === 0) && (
                  <div className="border-t border-hairline p-3 text-center text-xs text-muted-foreground">
                    Դաշտեր չկան — ավելացրեք նոր դաշտ
                  </div>
                )}
              </div>
            );
          })}

          <Button variant="outline" size="sm" className="w-full gap-2 border-dashed" onClick={addGroup}>
            <Plus className="size-4" /> Ավելացնել խումբ
          </Button>
        </div>

        {addFieldFor && (
          <AddFieldDialog groupId={addFieldFor} templateId={templateId} onClose={() => setAddFieldFor(null)} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function AddFieldDialog({ groupId, templateId, onClose }: { groupId: string; templateId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState("TEXT");
  const [required, setRequired] = useState(false);
  const [optionsText, setOptionsText] = useState("");
  const [conditionExpr, setConditionExpr] = useState("");

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/forms/${templateId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "failed"); }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Դաշտը ավելացված է");
      qc.invalidateQueries({ queryKey: ["form", templateId] });
      qc.invalidateQueries({ queryKey: ["forms"] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Սխալ"),
  });

  const submit = () => {
    if (!key || !label) { toast.error("Key և Label պարտադիր են"); return; }
    const options = (type === "SELECT" || type === "MULTISELECT") && optionsText
      ? optionsText.split("\n").map((s) => s.trim()).filter(Boolean)
      : undefined;
    mutation.mutate({
      op: "add_field",
      groupId,
      key: key.replace(/\s+/g, "_").toLowerCase(),
      label,
      type,
      required,
      options,
      conditionExpr: conditionExpr || undefined,
    });
  };

  const needsOptions = type === "SELECT" || type === "MULTISELECT";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Նոր դաշտ</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Key *</Label>
              <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="width" className="focus-steel font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Տիպ</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      <span className="font-mono mr-2">{FIELD_TYPE_ICONS[k]}</span> {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Label (Հայերեն) *</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Լայնություն (մմ)" className="focus-steel" />
          </div>
          {needsOptions && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Տարբերակներ (մեկական տող)</Label>
              <Textarea value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder={"սպիտակ\nսև\nմոխրագույն"} rows={4} className="focus-steel resize-none text-sm" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Պայման (optional)</Label>
            <Input value={conditionExpr} onChange={(e) => setConditionExpr(e.target.value)} placeholder="operation == 'մոտորով'" className="focus-steel font-mono text-xs" />
            <p className="text-[10px] text-muted-foreground">DSL — դաշտը կցուցադրվի միայն եթե պայմանը ճշմարիտ է</p>
          </div>
          <div className="flex items-center gap-2 p-2 border border-hairline">
            <Switch checked={required} onCheckedChange={setRequired} />
            <Label className="text-xs cursor-pointer" onClick={() => setRequired(!required)}>Պարտադիր դաշտ</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Չեղարկել</Button>
          <Button onClick={submit} disabled={mutation.isPending} className="bg-primary gap-2">
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Ավելացնել
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
