"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, Package, ShoppingCart, Warehouse as WarehouseIcon,
  Truck, FileText, Settings, Settings2, LogOut, Menu, Search, Bell, Factory, Building2,
  ChevronDown, Sparkles, Receipt, Crown, Calculator, Mail, MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { AdminDashboard } from "@/components/admin/dashboard";
import { ClientsModule } from "@/components/admin/clients-module";
import { OrdersModule } from "@/components/admin/orders-module";
import { ProductsModule } from "@/components/admin/products-module";
import { InventoryModule } from "@/components/admin/inventory-module";
import { OperatorDashboard } from "@/components/operator/dashboard";
import { WarehouseDashboard } from "@/components/warehouse/dashboard";
import { WarehousePicks } from "@/components/warehouse/picks";
import { AIAssistant } from "@/components/admin/ai-assistant";
import { CommandPalette } from "@/components/shell/command-palette";
import { FinanceModule } from "@/components/admin/finance-module";
import { ProcurementModule } from "@/components/admin/procurement-module";
import { TaxModule } from "@/components/admin/tax-module";
import { LoyaltyModule } from "@/components/admin/loyalty-module";
import { DocumentsModule } from "@/components/admin/documents-module";
import { CommsModule } from "@/components/admin/comms-module";
import { SettingsModule } from "@/components/admin/settings-module";
import { FormBuilderModule } from "@/components/forms/form-builder";
import { BomRulesModule } from "@/components/admin/bom-rules-module";
import { SuppliersModule } from "@/components/admin/suppliers-module";

type NavItem = { key: string; label: string; icon: LucideIcon; module: string; roles: string[] };

const NAV: NavItem[] = [
  { key: "dashboard", label: "Վահանակ", icon: LayoutDashboard, module: "dashboard", roles: ["ADMIN", "OPERATOR", "WAREHOUSE"] },
  { key: "clients", label: "Հաճախորդներ", icon: Users, module: "clients", roles: ["ADMIN", "OPERATOR"] },
  { key: "orders", label: "Պատվերներ", icon: ShoppingCart, module: "orders", roles: ["ADMIN", "OPERATOR", "WAREHOUSE"] },
  { key: "products", label: "Ապրանքներ", icon: Package, module: "products", roles: ["ADMIN", "OPERATOR", "WAREHOUSE"] },
  { key: "inventory", label: "Պահեստ", icon: WarehouseIcon, module: "inventory", roles: ["ADMIN", "WAREHOUSE"] },
  { key: "picks", label: "Ընտրում", icon: Package, module: "picks", roles: ["WAREHOUSE"] },
  { key: "procurement", label: "Մատակարարում", icon: Truck, module: "procurement", roles: ["ADMIN"] },
  { key: "suppliers", label: "Մատակարարներ", icon: Building2, module: "suppliers", roles: ["ADMIN"] },
  { key: "finance", label: "Ֆինանսներ", icon: Receipt, module: "finance", roles: ["ADMIN"] },
  { key: "loyalty", label: "Հավատարմություն", icon: Crown, module: "loyalty", roles: ["ADMIN"] },
  { key: "tax", label: "Հարկեր", icon: Calculator, module: "tax", roles: ["ADMIN"] },
  { key: "documents", label: "Փաստաթղթեր", icon: FileText, module: "documents", roles: ["ADMIN", "OPERATOR", "WAREHOUSE"] },
  { key: "comms", label: "Հաղորդակցություն", icon: Mail, module: "comms", roles: ["ADMIN", "OPERATOR"] },
  { key: "ai", label: "AI Օգնական", icon: Sparkles, module: "ai", roles: ["ADMIN", "OPERATOR"] },
  { key: "forms", label: "Դինամիկ ձևեր", icon: FileText, module: "forms", roles: ["ADMIN"] },
  { key: "bom", label: "BOM Կանոններ", icon: Settings2, module: "bom", roles: ["ADMIN"] },
  { key: "settings", label: "Կարգավորումներ", icon: Settings, module: "settings", roles: ["ADMIN"] },
];

export function WorkspaceShell() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role as "ADMIN" | "OPERATOR" | "WAREHOUSE";
  const [active, setActive] = useState("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Cmd+K shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const items = NAV.filter((n) => n.roles.includes(role));

  const renderModule = () => {
    if (active === "dashboard") {
      if (role === "ADMIN") return <AdminDashboard />;
      if (role === "OPERATOR") return <OperatorDashboard />;
      if (role === "WAREHOUSE") return <WarehouseDashboard />;
    }
    if (role === "WAREHOUSE" && active === "picks") return <WarehousePicks />;
    if (active === "clients") return <ClientsModule role={role} />;
    if (active === "orders") return <OrdersModule role={role} />;
    if (active === "products") return <ProductsModule role={role} />;
    if (active === "inventory") return <InventoryModule role={role} />;
    if (active === "ai") return <AIAssistant role={role} />;
    if (active === "finance" && role === "ADMIN") return <FinanceModule role={role} />;
    if (active === "procurement" && role === "ADMIN") return <ProcurementModule />;
    if (active === "suppliers" && role === "ADMIN") return <SuppliersModule />;
    if (active === "tax" && role === "ADMIN") return <TaxModule />;
    if (active === "loyalty" && role === "ADMIN") return <LoyaltyModule />;
    if (active === "documents") return <DocumentsModule />;
    if (active === "comms") return <CommsModule />;
    if (active === "forms" && role === "ADMIN") return <FormBuilderModule />;
    if (active === "bom" && role === "ADMIN") return <BomRulesModule />;
    if (active === "settings" && role === "ADMIN") return <SettingsModule />;
    return <ComingSoon label={items.find((i) => i.key === active)?.label ?? active} />;
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-hairline bg-sidebar">
        <SidebarContent items={items} active={active} onSelect={setActive} role={role} userName={session?.user?.name ?? ""} userEmail={session?.user?.email ?? ""} />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden absolute top-3 left-3 z-50">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent items={items} active={active} onSelect={(k) => { setActive(k); setMobileOpen(false); }} role={role} userName={session?.user?.name ?? ""} userEmail={session?.user?.email ?? ""} />
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-hairline flex items-center justify-between px-4 lg:px-6 gap-4">
          <div className="flex items-center gap-3 lg:gap-4 ml-12 lg:ml-0">
            <h2 className="text-sm font-medium truncate">
              {items.find((i) => i.key === active)?.label ?? "Վահանակ"}
            </h2>
            <Badge variant="outline" className="hidden sm:inline-flex text-[10px] uppercase tracking-wider border-hairline">
              {role === "ADMIN" ? "Ադմինիստրատոր" : role === "OPERATOR" ? "Օպերատոր" : "Պահեստապետ"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPaletteOpen(true)} className="gap-2 text-muted-foreground">
              <Search className="size-4" />
              <span className="hidden md:inline">Որոնում</span>
              <kbd className="hidden md:inline-flex text-[10px] px-1.5 py-0.5 border border-hairline rounded-sm">⌘K</kbd>
            </Button>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="size-4" />
              <span className="absolute top-1.5 right-1.5 size-1.5 bg-status-red rounded-full" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut({ redirect: false })} className="gap-2">
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Ելք</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">
            {renderModule()}
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} items={items} onSelect={(k) => { setActive(k); setPaletteOpen(false); }} />
    </div>
  );
}

function SidebarContent({ items, active, onSelect, role, userName, userEmail }: {
  items: NavItem[];
  active: string;
  onSelect: (k: string) => void;
  role: string;
  userName: string;
  userEmail: string;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="h-14 flex items-center px-4 border-b border-hairline">
        <div className="flex items-center gap-2.5">
          <div className="size-8 bg-primary flex items-center justify-center">
            <Factory className="size-4 text-copper" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">METAL BLINDS</div>
            <div className="text-[10px] text-muted-foreground tracking-widest uppercase">ERP · ARM</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors text-left",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
      <Separator className="bg-hairline" />
      <div className="p-3">
        <div className="flex items-center gap-2.5">
          <div className="size-8 bg-muted flex items-center justify-center text-xs font-medium">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{userName}</div>
            <div className="text-[10px] text-muted-foreground truncate">{userEmail}</div>
          </div>
          <ChevronDown className="size-3 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="border border-dashed border-hairline p-12 text-center">
      <div className="text-sm text-muted-foreground">
        «{label}» մոդուլը պատրաստվում է
      </div>
    </div>
  );
}
