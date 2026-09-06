import type { ColecaoNome, DBAdapter, Registro } from "./types";

/**
 * Adaptador local (navegador). Usado enquanto o Firebase não está conectado.
 * A troca para o Firebase é feita em src/lib/db/index.ts, sem alterar telas.
 */
const PREFIXO = "ideal-jairo:";
const listeners = new Map<ColecaoNome, Set<() => void>>();

function ler<T>(colecao: ColecaoNome): T[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(PREFIXO + colecao) || "[]") as T[];
  } catch {
    return [];
  }
}

function escrever<T>(colecao: ColecaoNome, dados: T[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREFIXO + colecao, JSON.stringify(dados));
  listeners.get(colecao)?.forEach((cb) => cb());
}

export const localAdapter: DBAdapter = {
  nome: "local",
  async listar<T extends Registro>(colecao: ColecaoNome) {
    return ler<T>(colecao);
  },
  async salvar<T extends Registro>(colecao: ColecaoNome, registro: T) {
    const dados = ler<T>(colecao);
    const i = dados.findIndex((d) => d.id === registro.id);
    if (i >= 0) dados[i] = registro;
    else dados.unshift(registro);
    escrever(colecao, dados);
    return registro;
  },
  async remover(colecao: ColecaoNome, id: string) {
    escrever(
      colecao,
      ler<Registro>(colecao).filter((d) => d.id !== id),
    );
  },
  observar(colecao, cb) {
    if (!listeners.has(colecao)) listeners.set(colecao, new Set());
    listeners.get(colecao)!.add(cb);
    return () => listeners.get(colecao)!.delete(cb);
  },
};

export const lerSync = ler;
export const escreverSync = escrever;
