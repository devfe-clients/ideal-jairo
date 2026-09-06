import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Perfil } from "./schemas";

export type Permissao =
  | "clientes"
  | "veiculos"
  | "agenda"
  | "os"
  | "orcamentos"
  | "estoque"
  | "compras"
  | "financeiro"
  | "relatorios"
  | "usuarios"
  | "configuracoes"
  | "ver-margem"
  | "excluir";

const MATRIZ: Record<Perfil, Permissao[]> = {
  Administrador: [
    "clientes",
    "veiculos",
    "agenda",
    "os",
    "orcamentos",
    "estoque",
    "compras",
    "financeiro",
    "relatorios",
    "usuarios",
    "configuracoes",
    "ver-margem",
    "excluir",
  ],
  "Responsável técnico": [
    "clientes",
    "veiculos",
    "agenda",
    "os",
    "orcamentos",
    "estoque",
    "compras",
    "relatorios",
    "ver-margem",
  ],
  Administrativo: ["clientes", "veiculos", "agenda", "os", "orcamentos", "financeiro", "relatorios"],
  Mecânico: ["os", "veiculos", "agenda"],
};

type Sessao = { nome: string; perfil: Perfil };

const AuthContext = createContext<{
  usuario: Sessao;
  setUsuario: (s: Sessao) => void;
  pode: (p: Permissao) => boolean;
} | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Sessao>({
    nome: "Jairo Alves de Oliveira",
    perfil: "Administrador",
  });

  const valor = useMemo(
    () => ({
      usuario,
      setUsuario,
      pode: (p: Permissao) => MATRIZ[usuario.perfil].includes(p),
    }),
    [usuario],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return ctx;
}

export const permissoesDoPerfil = (perfil: Perfil) => MATRIZ[perfil];
