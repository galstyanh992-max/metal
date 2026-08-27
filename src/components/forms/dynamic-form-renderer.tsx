"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { evaluateCondition } from "@/lib/bom/dsl";
import { ChevronRight } from "lucide-react";

export interface FormField {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  options: string | null;
  validation: string | null;
  conditionExpr: string | null;
  defaultValue: string | null;
  archivedAt?: Date | null;
}

export interface FormGroup {
  id: string;
  label: string;
  sortOrder: number;
  conditionExpr: string | null;
  fields: FormField[];
}

export interface FormTemplate {
  id: string;
  name: string;
  groups: FormGroup[];
}

interface DynamicFormRendererProps {
  template: FormTemplate | null | undefined;
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  className?: string;
}

export function DynamicFormRenderer({ template, values, onChange, className }: DynamicFormRendererProps) {
  if (!template?.groups?.length) {
    return (
      <div className="text-xs text-muted-foreground p-3 border border-dashed border-hairline text-center">
        Ձևի ձևանմուշ չի գտնվել
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className ?? ""}`}>
      {template.groups.map((group) => {
        // Check group condition
        if (group.conditionExpr && !evaluateCondition(group.conditionExpr, values)) return null;

        const visibleFields = group.fields.filter((f) => {
          if (f.archivedAt) return false;
          if (f.conditionExpr && !evaluateCondition(f.conditionExpr, values)) return false;
          return true;
        });

        if (visibleFields.length === 0) return null;

        return (
          <div key={group.id} className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground font-medium">
              <ChevronRight className="size-3" />
              {group.label}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pl-4 border-l border-hairline">
              {visibleFields.map((field) => (
                <FieldRenderer key={field.id} field={field} value={values[field.key]} onChange={(v) => onChange(field.key, v)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FieldRenderer({ field, value, onChange }: { field: FormField; value: any; onChange: (v: any) => void }) {
  const label = (
    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
      {field.label}
      {field.required && <span className="text-destructive">*</span>}
    </Label>
  );

  const renderControl = () => {
    switch (field.type) {
      case "TEXT":
      case "PHONE":
      case "EMAIL":
      case "COLOR":
        return <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="h-9 focus-steel text-sm" placeholder={field.label} type={field.type === "EMAIL" ? "email" : field.type === "PHONE" ? "tel" : "text"} />;
      case "TEXTAREA":
      case "ADDRESS":
        return <Textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={2} className="focus-steel resize-none text-sm" placeholder={field.label} />;
      case "NUMBER":
      case "DECIMAL":
      case "DIMENSION":
      case "QUANTITY":
      case "MONEY":
        return <Input type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="h-9 focus-steel tabular-nums text-sm" placeholder="0" />;
      case "BOOLEAN":
        return (
          <div className="flex items-center h-9">
            <Switch checked={!!value} onCheckedChange={onChange} />
          </div>
        );
      case "DATE":
        return <Input type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="h-9 focus-steel text-sm" />;
      case "SELECT": {
        const options = field.options ? JSON.parse(field.options) : [];
        return (
          <Select value={value ?? ""} onValueChange={onChange}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Ընտրել…" /></SelectTrigger>
            <SelectContent>
              {options.map((opt: string) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        );
      }
      case "MULTISELECT": {
        const options = field.options ? JSON.parse(field.options) : [];
        const current = Array.isArray(value) ? value : (value ? [value] : []);
        return (
          <div className="flex flex-wrap gap-1 min-h-9 p-1 border border-hairline">
            {options.map((opt: string) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  const next = current.includes(opt) ? current.filter((v: string) => v !== opt) : [...current, opt];
                  onChange(next);
                }}
                className={`text-[10px] px-1.5 py-0.5 border transition-colors ${current.includes(opt) ? "bg-primary text-primary-foreground border-primary" : "border-hairline hover:bg-muted"}`}
              >
                {opt}
              </button>
            ))}
          </div>
        );
      }
      case "PHOTO":
      case "FILE":
        return <Input type="file" onChange={(e) => onChange(e.target.files?.[0]?.name ?? "")} className="h-9 text-xs" />;
      default:
        return <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="h-9 focus-steel text-sm" />;
    }
  };

  // Full-width for textarea, multiselect, file
  const fullWidth = ["TEXTAREA", "ADDRESS", "MULTISELECT", "PHOTO", "FILE"].includes(field.type);

  return (
    <div className={`space-y-1 ${fullWidth ? "col-span-2 md:col-span-3" : ""}`}>
      {label}
      {renderControl()}
    </div>
  );
}
