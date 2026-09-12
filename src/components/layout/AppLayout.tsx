import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  BarChart3,
  CalendarDays,
  Car,
  ClipboardList,
  FileText,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
  LayoutDashboard,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import logo from "@/assets/logo.jpg.asset.json";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { modoBanco } from "@/lib/db";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const NAV = [
  { to: "/", label: "Painel", icon: LayoutDashboard, perm: "os" },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, perm: "agenda" },
  { to: "/os", label: "Ordens de serviço", icon: ClipboardList, perm: "os" },
  { to: "/orcamentos", label: "Orçamentos", icon: FileText, perm: "orcamentos" },
  { to: "/clientes", label: "Clientes", icon: Users, perm: "clientes" },
  { to: "/veiculos", label: "Veículos", icon: Car, perm: "veiculos" },
  { to: "/estoque", label: "Estoque", icon: Package, perm: "estoque" },
  { to: "/compras", label: "Compras de peças", icon: ShoppingCart, perm: "compras" },
  { to: "/financeiro", label: "Financeiro", icon: Wallet, perm: "financeiro" },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3, perm: "relatorios" },
  { to: "/usuarios", label: "Usuários e LGPD", icon: ShieldCheck, perm: "usuarios" },
  { to: "/configuracoes", label: "Configurações", icon: Settings, perm: "configuracoes" },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { pode } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.filter((i) => pode(i.perm as never)).map((item) => {
        const ativo = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              ativo
                ? "bg-primary text-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Marca() {
  return (
    <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
      <img
        src={logo.url}
        alt="Ideal Jairo Mecânica Automotiva"
        className="h-10 w-10 rounded-md object-cover"
      />
      <div className="leading-tight">
        <p className="font-display text-sm font-bold tracking-wide">IDEAL JAIRO</p>
        <p className="text-[11px] text-muted-foreground">Mecânica Automotiva</p>
      </div>
    </div>
  );
}

export function AppLayout({
  titulo,
  descricao,
  acoes,
  children,
}: {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const { usuario, sair } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <Marca />
        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <div className="border-t border-sidebar-border p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{usuario?.nome}</p>
          <p>{usuario?.perfil}</p>
          <Badge variant="outline" className="mt-2 text-[10px]">
            Banco: {modoBanco === "local" ? "local (Firebase pendente)" : "Firebase"}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start gap-2 text-xs text-muted-foreground hover:text-destructive"
            onClick={() => void sair()}
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </Button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <Sheet open={aberto} onOpenChange={setAberto}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0">
              <Marca />
              <NavLinks onNavigate={() => setAberto(false)} />
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold sm:text-xl">{titulo}</h1>
            {descricao ? (
              <p className="truncate text-xs text-muted-foreground">{descricao}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">{acoes}</div>
        </header>
        <main className="p-4 pb-16 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
