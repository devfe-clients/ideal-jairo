import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";
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
    "clientes", "veiculos", "agenda", "os", "orcamentos", "estoque",
    "compras", "financeiro", "relatorios", "usuarios", "configuracoes",
    "ver-margem", "excluir",
  ],
  "Responsável técnico": [
    "clientes", "veiculos", "agenda", "os", "orcamentos",
    "estoque", "compras", "relatorios", "ver-margem",
  ],
  Administrativo: ["clientes", "veiculos", "agenda", "os", "orcamentos", "financeiro", "relatorios"],
  Mecânico: ["os", "veiculos", "agenda"],
};

/** Mapeia o custom claim 'perfil' (snake_case do Firebase) para o Perfil do sistema. */
function claimParaPerfil(claim?: string): Perfil {
  const mapa: Record<string, Perfil> = {
    admin: "Administrador",
    tecnico: "Responsável técnico",
    administrativo: "Administrativo",
    mecanico: "Mecânico",
  };
  return mapa[claim ?? ""] ?? "Mecânico";
}

type Sessao = { uid: string; nome: string; email: string; perfil: Perfil };

type AuthContextType = {
  usuario: Sessao | null;
  carregando: boolean;
  pode: (p: Permissao) => boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Sessao | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!auth) {
      setCarregando(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (user: User | null) => {
      if (!user) {
        setUsuario(null);
        setCarregando(false);
        return;
      }

      //busca os custom claims (perfil e ativo)
      const token = await user.getIdTokenResult(true);
      const claims = token.claims as Record<string, unknown>;

      if (!claims["ativo"]) {
        if (typeof window !== "undefined" && window.location.pathname.startsWith("/agendar")) {
          setUsuario(null);
          setCarregando(false);
          return;
        }
        //usuário sem permissão no sistema interno — desloga
        await signOut(auth!);
        setUsuario(null);
        setCarregando(false);
        return;
      }

      setUsuario({
        uid: user.uid,
        nome: user.displayName ?? user.email ?? "Usuário",
        email: user.email ?? "",
        perfil: claimParaPerfil(claims["perfil"] as string | undefined),
      });
      setCarregando(false);
    });

    return unsub;
  }, []);

  const valor = useMemo<AuthContextType>(
    () => ({
      usuario,
      carregando,
      pode: (p: Permissao) =>
        usuario ? MATRIZ[usuario.perfil].includes(p) : false,
      entrar: async (email: string, senha: string) => {
        if (!auth) throw new Error("Firebase Auth não inicializado.");
        await signInWithEmailAndPassword(auth, email, senha);
      },
      sair: async () => {
        if (!auth) return;
        await signOut(auth);
      },
    }),
    [usuario, carregando],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return ctx;
}

export const permissoesDoPerfil = (perfil: Perfil) => MATRIZ[perfil];