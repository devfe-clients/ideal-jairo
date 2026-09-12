import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  serverTimestamp,
  limit,
} from "firebase/firestore";
import { firestore } from "../firebase";
import type { ColecaoNome, DBAdapter, Registro } from "./types";

export { firebaseConfigurado } from "../firebaseConfig";

const MAPA_COLECAO: Record<ColecaoNome, string> = {
  clientes:     "clientes",
  veiculos:     "veiculos",
  ordens:       "ordens_de_servico",
  pecas:        "estoque",
  servicos:     "estoque",
  compras:      "compras",
  lancamentos:  "financeiro/contas_a_receber/lancamentos", 
  agendamentos: "agendamentos",
  usuarios:     "usuarios",
  auditoria:    "auditoria",
  config:       "configuracoes",
};

function caminhoLancamento(tipo?: string): string {
  return tipo === "pagar"
    ? "financeiro/contas_a_pagar/lancamentos"
    : "financeiro/contas_a_receber/lancamentos";
}

function caminhoFirestore(colecao: ColecaoNome, tipoLancamento?: string): string {
  if (colecao === "lancamentos") return caminhoLancamento(tipoLancamento);
  return MAPA_COLECAO[colecao];
}

/** Converte Timestamps do Firestore para string ISO, preserva o resto. */
function normalizar<T extends Registro>(id: string, data: Record<string, unknown>): T {
  const out: Record<string, unknown> = { id };
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === "object" && "toDate" in v && typeof (v as { toDate: unknown }).toDate === "function") {
      out[k] = (v as { toDate: () => Date }).toDate().toISOString();
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

export const firebaseAdapter: DBAdapter = {
  nome: "firebase",

  async listar<T extends Registro>(colecao: ColecaoNome): Promise<T[]> {
    if (!firestore) throw new Error("Firebase não inicializado.");

    if (colecao === "lancamentos") {
      const [snapR, snapP] = await Promise.all([
        getDocs(query(
          collection(firestore, "financeiro/contas_a_receber/lancamentos"),
          orderBy("criadoEm", "desc"), limit(500),
        )),
        getDocs(query(
          collection(firestore, "financeiro/contas_a_pagar/lancamentos"),
          orderBy("criadoEm", "desc"), limit(500),
        )),
      ]);
      return [
        ...snapR.docs.map((d) => normalizar<T>(d.id, d.data())),
        ...snapP.docs.map((d) => normalizar<T>(d.id, d.data())),
      ];
    }

    const snap = await getDocs(
      query(
        collection(firestore, caminhoFirestore(colecao)),
        orderBy("criadoEm", "desc"),
        limit(1000),
      ),
    );
    return snap.docs.map((d) => normalizar<T>(d.id, d.data()));
  },

  async salvar<T extends Registro>(colecao: ColecaoNome, registro: T): Promise<T> {
    if (!firestore) throw new Error("Firebase não inicializado.");

    const tipo = (registro as Record<string, unknown>)["tipo"] as string | undefined;
    const caminho = caminhoFirestore(colecao, tipo);
    const ref = doc(firestore, caminho, registro.id);

    const { id, ...dados } = registro;
    void id;

    const agora = new Date().toISOString();
    const jaExiste = (await getDoc(ref)).exists();
    const usuarioId = (dados as Record<string, unknown>)["criadoPor"] as string ?? "sistema";

    const payload = {
      ...dados,
      criadoPor: usuarioId,
      atualizadoPor: usuarioId,
      atualizadoEm: serverTimestamp(),
      ...(jaExiste ? {} : { criadoEm: serverTimestamp() }),
    };
    await setDoc(ref, payload, { merge: true });

    return { ...registro, atualizadoEm: agora } as T;
  },

  async remover(colecao: ColecaoNome, id: string): Promise<void> {
    if (!firestore) throw new Error("Firebase não inicializado.");

    if (colecao === "lancamentos") {
      await Promise.allSettled([
        deleteDoc(doc(firestore, `financeiro/contas_a_receber/lancamentos/${id}`)),
        deleteDoc(doc(firestore, `financeiro/contas_a_pagar/lancamentos/${id}`)),
      ]);
      return;
    }
    await deleteDoc(doc(firestore, caminhoFirestore(colecao), id));
  },

  observar(colecao: ColecaoNome, cb: () => void): () => void {
    if (!firestore) return () => {};

    if (colecao === "lancamentos") {
      const u1 = onSnapshot(collection(firestore, "financeiro/contas_a_receber/lancamentos"), cb);
      const u2 = onSnapshot(collection(firestore, "financeiro/contas_a_pagar/lancamentos"), cb);
      return () => { u1(); u2(); };
    }

    return onSnapshot(
      query(collection(firestore, caminhoFirestore(colecao)), orderBy("criadoEm", "desc")),
      cb,
    );
  },
};