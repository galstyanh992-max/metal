"use client";

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { LucideIcon } from "lucide-react";

type Item = { key: string; label: string; icon: LucideIcon };

export function CommandPalette({ open, onOpenChange, items, onSelect }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: Item[];
  onSelect: (k: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 overflow-hidden max-w-lg">
        <Command>
          <CommandInput placeholder="Որոնում՝ մոդուլներ, գործողություններ…" />
          <CommandList>
            <CommandEmpty>Ոչինչ չի գտնվել</CommandEmpty>
            <CommandGroup heading="Մոդուլներ">
              {items.map((it) => {
                const Icon = it.icon;
                return (
                  <CommandItem key={it.key} value={it.label} onSelect={() => onSelect(it.key)}>
                    <Icon className="size-4 mr-2" />
                    {it.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
