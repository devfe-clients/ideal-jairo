import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";

type ClienteAuth = {
  uid: string;
  nome: string;
  email: string;
  foto: string;
};

type ClienteAuthContextType = {
  cliente: ClienteAuth | null;
  carregando: boolean;
  entrarComGoogle: () => Promise<void>;
  sair: () => Promise<void>;
};

const ClienteAuthContext = createContext<ClienteAuthContextType | null>(null);

export function ClienteAuthProvider({ children }: { children: ReactNode }) {
  const [cliente, setCliente] = useState<ClienteAuth | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!auth) {
      setCarregando(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        setCliente({
          uid: user.uid,
          nome: user.displayName ?? user.email ?? "Cliente",
          email: user.email ?? "",
          foto: user.photoURL ?? "",
        });
      } else {
        setCliente(null);
      }
      setCarregando(false);
    });

    return unsub;
  }, []);

  const valor = useMemo<ClienteAuthContextType>(
    () => ({
      cliente,
      carregando,
      entrarComGoogle: async () => {
        if (!auth) throw new Error("Firebase Auth não inicializado.");
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      },
      sair: async () => {
        if (!auth) return;
        await signOut(auth);
      },
    }),
    [cliente, carregando],
  );

  return (
    <ClienteAuthContext.Provider value={valor}>
      {children}
    </ClienteAuthContext.Provider>
  );
}

export function useClienteAuth() {
  const ctx = useContext(ClienteAuthContext);
  if (!ctx) throw new Error("useClienteAuth precisa estar dentro de ClienteAuthProvider");
  return ctx;
}