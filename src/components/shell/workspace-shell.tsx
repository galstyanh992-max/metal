"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, Package, ShoppingCart, Warehouse as WarehouseIcon,
  Truck, FileText, Settings, LogOut, Menu, Search, Bell, Factory, Building2, BarChart3, Activity,
  ChevronDown, Receipt, Crown, Calculator, Mail, MessageCircle, DoorOpen,
  type LucideIcon,
} from "lucide-react";
import { AssistantCloud } from "@/components/assistant/assistant-cloud";
import { CommandPalette } from "@/components/shell/command-palette";
import { NotificationsBell } from "@/components/shell/notifications-bell";
import { ErrorBoundary } from "@/components/shared/error-boundary";

const moduleLoading = () => <div className="h-40 animate-pulse rounded-lg bg-muted/40" />;
const AdminDashboard = dynamic(() => import("@/components/admin/dashboard").then((module) => module.AdminDashboard), { loading: moduleLoading });
const ClientsOrdersModule = dynamic(() => import("@/components/admin/clients-orders-module").then((module) => module.ClientsOrdersModule), { loading: moduleLoading });
const OrdersModule = dynamic(() => import("@/components/admin/orders-module").then((module) => module.OrdersModule), { loading: moduleLoading });
const ProductsModule = dynamic(() => import("@/components/admin/products-module").then((module) => module.ProductsModule), { loading: moduleLoading });
const InventoryModule = dynamic(() => import("@/components/admin/inventory-module").then((module) => module.InventoryModule), { loading: moduleLoading });
const OperatorDashboard = dynamic(() => import("@/components/operator/dashboard").then((module) => module.OperatorDashboard), { loading: moduleLoading });
const WarehouseDashboard = dynamic(() => import("@/components/warehouse/dashboard").then((module) => module.WarehouseDashboard), { loading: moduleLoading });
const WarehousePicks = dynamic(() => import("@/components/warehouse/picks").then((module) => module.WarehousePicks), { loading: moduleLoading });
const FinanceModule = dynamic(() => import("@/components/admin/finance-module").then((module) => module.FinanceModule), { loading: moduleLoading });
const ProcurementModule = dynamic(() => import("@/components/admin/procurement-module").then((module) => module.ProcurementModule), { loading: moduleLoading });
const TaxModule = dynamic(() => import("@/components/admin/tax-module").then((module) => module.TaxModule), { loading: moduleLoading });
const LoyaltyModule = dynamic(() => import("@/components/admin/loyalty-module").then((module) => module.LoyaltyModule), { loading: moduleLoading });
const DocumentsModule = dynamic(() => import("@/components/admin/documents-module").then((module) => module.DocumentsModule), { loading: moduleLoading });
const CommsModule = dynamic(() => import("@/components/admin/comms-module").then((module) => module.CommsModule), { loading: moduleLoading });
const SettingsModule = dynamic(() => import("@/components/admin/settings-module").then((module) => module.SettingsModule), { loading: moduleLoading });
const FormBuilderModule = dynamic(() => import("@/components/forms/form-builder").then((module) => module.FormBuilderModule), { loading: moduleLoading });
const SuppliersModule = dynamic(() => import("@/components/admin/suppliers-module").then((module) => module.SuppliersModule), { loading: moduleLoading });
const ReportsModule = dynamic(() => import("@/components/admin/reports-module").then((module) => module.ReportsModule), { loading: moduleLoading });

type NavItem = { key: string; label: string; icon: LucideIcon; module: string; roles: string[] };

const NAV: NavItem[] = [
  { key: "dashboard", label: "Վահանակ", icon: LayoutDashboard, module: "dashboard", roles: ["ADMIN", "OPERATOR", "WAREHOUSE"] },
  { key: "clients-orders", label: "Հաճախորդներ և Պատվերներ", icon: Users, module: "clients-orders", roles: ["ADMIN", "OPERATOR", "WAREHOUSE"] },
  { key: "orders", label: "Պատվերներ", icon: ShoppingCart, module: "orders", roles: ["ADMIN", "OPERATOR", "WAREHOUSE"] },
  { key: "products", label: "Ապրանքներ", icon: Package, module: "products", roles: ["ADMIN", "OPERATOR", "WAREHOUSE"] },
  { key: "inventory", label: "Պահեստ", icon: WarehouseIcon, module: "inventory", roles: ["ADMIN"] },
  { key: "picks", label: "Ընտրում", icon: Package, module: "picks", roles: ["WAREHOUSE"] },
  { key: "procurement", label: "Մատակարարում", icon: Truck, module: "procurement", roles: ["ADMIN"] },
  { key: "suppliers", label: "Մատակարարներ", icon: Building2, module: "suppliers", roles: ["ADMIN"] },
  { key: "finance", label: "Ֆինանսներ", icon: Receipt, module: "finance", roles: ["ADMIN"] },
  { key: "loyalty", label: "Հավատարմություն", icon: Crown, module: "loyalty", roles: ["ADMIN"] },
  { key: "tax", label: "Հարկեր", icon: Calculator, module: "tax", roles: ["ADMIN"] },
  { key: "documents", label: "Փաստաթղթեր", icon: FileText, module: "documents", roles: ["ADMIN", "OPERATOR", "WAREHOUSE"] },
  { key: "reports", label: "Հաշվետվություններ", icon: BarChart3, module: "reports", roles: ["ADMIN"] },
  { key: "comms", label: "Հաղորդակցություն", icon: Mail, module: "comms", roles: ["ADMIN", "OPERATOR"] },
  { key: "forms", label: "Դինամիկ ձևեր", icon: FileText, module: "forms", roles: ["ADMIN"] },
  { key: "activity", label: "Գործողությունների մատյան", icon: Activity, module: "activity", roles: ["ADMIN"] },
  { key: "settings", label: "Կարգավորումներ", icon: Settings, module: "settings", roles: ["ADMIN"] },
];

const NAV_GROUPS = [
  { label: "Աշխատանք", keys: ["dashboard", "clients-orders", "orders", "products", "inventory", "picks"] },
  { label: "Գնումներ և ֆինանսներ", keys: ["procurement", "suppliers", "finance", "loyalty", "tax"] },
  { label: "Վերլուծություն և կապ", keys: ["documents", "reports", "comms"] },
  { label: "Կարգավորումներ", keys: ["forms", "activity", "settings"] },
];

export function WorkspaceShell() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role as "ADMIN" | "OPERATOR" | "WAREHOUSE";
  const [active, setActive] = useState("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [savedOrderId, setSavedOrderId] = useState<string | null>(null);

  const selectModule = (module: string) => {
    setSavedOrderId(null);
    setActive(module);
  };
  const openSavedOrder = (order: { id: string }) => {
    setSavedOrderId(order.id);
    setActive("orders");
  };

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

  const handleLogout = async () => {
    try {
      const csrfRes = await fetch("/api/auth/csrf");
      const { csrfToken } = await csrfRes.json();
      await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `csrfToken=${encodeURIComponent(csrfToken)}&callbackUrl=/&json=true`,
      });
    } catch (e) {
      console.error("Logout error:", e);
    }
    window.location.href = "/";
  };

  const renderModule = () => {
    if (active === "dashboard") {
      if (role === "ADMIN") return <AdminDashboard />;
      if (role === "OPERATOR") return <OperatorDashboard />;
      if (role === "WAREHOUSE") return <WarehouseDashboard />;
    }
    if (role === "WAREHOUSE" && active === "picks") return <WarehousePicks />;
    if (active === "clients-orders") return <ClientsOrdersModule role={role} onOrderCreated={openSavedOrder} />;
    if (active === "orders") return <OrdersModule key={savedOrderId ?? "orders"} role={role} initialOrderId={savedOrderId} />;
    if (active === "products") return <ProductsModule role={role} />;
    if (active === "inventory") return <ErrorBoundary><InventoryModule role={role} /></ErrorBoundary>;
    if (active === "finance" && role === "ADMIN") return <FinanceModule role={role} />;
    if (active === "procurement" && role === "ADMIN") return <ProcurementModule />;
    if (active === "suppliers" && role === "ADMIN") return <SuppliersModule />;
    if (active === "tax" && role === "ADMIN") return <TaxModule />;
    if (active === "loyalty" && role === "ADMIN") return <LoyaltyModule />;
    if (active === "documents") return <DocumentsModule />;
    if (active === "reports" && role === "ADMIN") return <ReportsModule />;
    if (active === "comms") return <CommsModule />;
    if (active === "forms" && role === "ADMIN") return <FormBuilderModule />;
    if (active === "activity" && role === "ADMIN") return <SettingsModule key="activity" initialTab="audit" />;
    if (active === "settings" && role === "ADMIN") return <SettingsModule key="settings" />;
    return <ComingSoon label={items.find((i) => i.key === active)?.label ?? active} />;
  };

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden lg:flex w-56 flex-col border-r bg-sidebar">
        <SidebarContent items={items} active={active} onSelect={selectModule} role={role} userName={session?.user?.name ?? ""} userEmail={session?.user?.email ?? ""} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden absolute top-2 left-2 z-50 size-10">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[82vw] max-w-72 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Հիմնական ցանկ</SheetTitle>
          </SheetHeader>
          <SidebarContent items={items} active={active} onSelect={(k) => { selectModule(k); setMobileOpen(false); }} role={role} userName={session?.user?.name ?? ""} userEmail={session?.user?.email ?? ""} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 border-b flex items-center justify-between px-3 sm:px-4 lg:px-6 gap-2 sm:gap-4 bg-card">
          <div className="flex flex-1 min-w-0 items-center gap-3 ml-11 lg:ml-0">
            <h2 className="text-sm font-medium truncate">
              {items.find((i) => i.key === active)?.label ?? "Վահանակ"}
            </h2>
            <Badge variant="outline" className="hidden sm:inline-flex text-[10px] uppercase tracking-wider rounded-md">
              {role === "ADMIN" ? "Ադմինիստրատոր" : role === "OPERATOR" ? "Օպերատոր" : "Պահեստապետ"}
            </Badge>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex size-8 items-center justify-center px-0 text-sm text-muted-foreground border rounded-lg hover:bg-muted/30 sm:w-auto sm:min-w-[120px] sm:px-3 lg:min-w-[200px]"
            >
              <Search className="size-3.5 shrink-0" />
              <span className="hidden md:inline flex-1 text-left text-xs">Որոնում…</span>
              <kbd className="hidden md:inline-flex text-[9px] px-1 py-0.5 border rounded">⌘K</kbd>
            </button>
            <NotificationsBell />
            <Button variant="ghost" size="sm" onClick={handleLogout} className="size-8 gap-2 rounded-lg px-0 sm:h-8 sm:w-auto sm:px-3">
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Ելք</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-3 sm:p-4 lg:p-6 max-w-[1600px] mx-auto page-enter">
            {renderModule()}
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} items={items} onSelect={(k) => { selectModule(k); setPaletteOpen(false); }} />

      <AssistantCloud />
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
      <div className="h-12 flex items-center px-4 border-b">
        <div className="flex items-center gap-2">
          <img src="/logo.jpeg" alt="Arm Roll" className="size-7 rounded-lg" />
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">ARM ROLL</div>
            <div className="text-[9px] text-muted-foreground tracking-widest uppercase">ERP · ARM</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-4">
        {NAV_GROUPS.map((group) => {
          const groupItems = items.filter((item) => group.keys.includes(item.key));
          if (groupItems.length === 0) return null;
          return (
            <div key={group.label} className="space-y-0.5">
              <div className="px-3 pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">{group.label}</div>
              {groupItems.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => onSelect(item.key)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left rounded-lg",
                      isActive
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-sidebar-foreground hover:bg-sidebar-accent"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>
      <Separator />
      <div className="p-2">
        <div className="flex items-center gap-2 p-2 rounded-lg">
          <div className="size-7 bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium rounded-lg">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">{userName}</div>
            <div className="text-[10px] text-muted-foreground truncate">{userEmail}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="border border-dashed border-hairline p-12 text-center rounded-lg">
      <div className="text-sm text-muted-foreground">
        «{label}» մոդուլը պատրաստվում է
      </div>
    </div>
  );
}
