"use client";

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { Users, ShoppingCart, Package, LayoutDashboard, type LucideIcon } from "lucide-react";
import { useState } from "react";

type Item = { key: string; label: string; icon: LucideIcon };

export function CommandPalette({ open, onOpenChange, items, onSelect }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: Item[];
  onSelect: (k: string) => void;
}) {
  const [query, setQuery] = useState("");

  const { data: searchData } = useQuery({
    queryKey: ["search", query],
    queryFn: async () => {
      if (!query || query.length < 2) return { results: [] };
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) return { results: [] };
      return res.json();
    },
    enabled: query.length >= 2,
  });

  const results = searchData?.results ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 overflow-hidden max-w-lg">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Որոնում՝ հաճախորդ, պատվեր, ապրանք, մոդուլ…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>{query.length < 2 ? "Մուտքագրեք առնվազն 2 նիշ" : "Ոչինչ չի գտնվել"}</CommandEmpty>

            {/* Module navigation */}
            <CommandGroup heading="Մոդուլներ">
              {items.map((it) => {
                const Icon = it.icon;
                return (
                  <CommandItem key={it.key} value={`mod-${it.label}`} onSelect={() => onSelect(it.key)}>
                    <Icon className="size-4 mr-2" />
                    {it.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>

            {/* Global search results */}
            {results.length > 0 && (
              <CommandGroup heading="Որոնման արդյունքներ">
                {results.map((r: any) => {
                  const Icon = r.type === "client" ? Users : r.type === "order" ? ShoppingCart : Package;
                  const typeLabel = r.type === "client" ? "Հաճախորդ" : r.type === "order" ? "Պատվեր" : "Ապրանք";
                  const target = r.type === "client" ? "clients" : r.type === "order" ? "orders" : "products";
                  return (
                    <CommandItem key={`${r.type}-${r.id}`} value={`${r.label}-${r.sub}`} onSelect={() => onSelect(target)}>
                      <Icon className="size-4 mr-2 text-copper" />
                      <div className="flex flex-col">
                        <span className="text-sm">{r.label}</span>
                        <span className="text-xs text-muted-foreground">{typeLabel} · {r.sub}</span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
