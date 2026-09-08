"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Search, User, Building2, Check, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SearchableClient = {
  id: string;
  type: "INDIVIDUAL" | "COMPANY";
  firstName?: string;
  lastName?: string;
  companyName?: string;
  phone: string;
  email?: string;
  taxId?: string;
};

/**
 * SearchableClientSelect — dropdown with search by name AND phone.
 *
 * Usage:
 *   <SearchableClientSelect
 *     clients={clients}
 *     value={clientId}
 *     onChange={setClientId}
 *     placeholder="Ընտրեք հաճախորդ"
 *   />
 *
 * Features:
 *   - Search by name (firstName, lastName, companyName) — case-insensitive
 *   - Search by phone — partial match
 *   - Search by email — partial match
 *   - Shows client type icon (User for individual, Building2 for company)
 *   - Shows phone number next to name
 *   - Keyboard: Enter to select first, Escape to close
 *   - Click outside to close
 */
export function SearchableClientSelect({
  clients,
  value,
  onChange,
  placeholder = "Ընտրեք հաճախորդ",
  disabled = false,
  className,
}: {
  clients: SearchableClient[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedClient = clients.find((c) => c.id === value);

  // Filter clients by search query
  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase().trim();
    return clients.filter((c) => {
      const name = c.type === "COMPANY" ? c.companyName ?? "" : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
      return (
        name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        (c.taxId?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [clients, search]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const selectClient = (id: string) => {
    onChange(id);
    setSearch("");
    setOpen(false);
  };

  const getClientName = (c: SearchableClient) =>
    c.type === "COMPANY" ? c.companyName ?? "" : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center w-full h-9 px-3 text-sm border border-hairline bg-card hover:bg-muted/30 rounded-sm transition-colors text-left",
          disabled && "opacity-50 cursor-not-allowed",
          !selectedClient && "text-muted-foreground"
        )}
      >
        {selectedClient ? (
          <>
            {selectedClient.type === "COMPANY" ? (
              <Building2 className="size-4 text-muted-foreground shrink-0 mr-2" />
            ) : (
              <User className="size-4 text-muted-foreground shrink-0 mr-2" />
            )}
            <span className="truncate flex-1">{getClientName(selectedClient)}</span>
            <span className="text-xs text-muted-foreground ml-2 shrink-0 tabular-nums">{selectedClient.phone}</span>
          </>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <ChevronDown className={cn("size-4 ml-2 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 border border-hairline bg-card shadow-lg rounded-sm max-h-80 flex flex-col">
          {/* Search input */}
          <div className="p-2 border-b border-hairline">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Որոնում՝ անուն, հեռախոս…"
                className="h-9 pl-9 text-sm focus-steel"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filtered.length > 0) {
                    e.preventDefault();
                    selectClient(filtered[0].id);
                  }
                  if (e.key === "Escape") {
                    setOpen(false);
                  }
                }}
              />
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {search ? "Որոնման արդյունքներ չկան" : "Հաճախորդներ չկան"}
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectClient(c.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-muted/30 transition-colors border-b border-hairline last:border-b-0",
                    c.id === value && "bg-primary/5"
                  )}
                >
                  {c.type === "COMPANY" ? (
                    <Building2 className="size-4 text-muted-foreground shrink-0" />
                  ) : (
                    <User className="size-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{getClientName(c)}</div>
                    {c.type === "COMPANY" && c.taxId && (
                      <div className="text-[10px] text-muted-foreground">ՀՎՀՀ {c.taxId}</div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums shrink-0">{c.phone}</div>
                  {c.id === value && <Check className="size-4 text-primary shrink-0" />}
                </button>
              ))
            )}
          </div>

          {/* Footer count */}
          {filtered.length > 0 && (
            <div className="px-3 py-1.5 border-t border-hairline text-[10px] text-muted-foreground uppercase tracking-wider">
              {filtered.length} հաճախորդ{search ? ` · որոնում՝ «${search}»` : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
