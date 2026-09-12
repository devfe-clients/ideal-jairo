import { useCallback, useEffect, useState } from "react";
import { localAdapter } from "./local-adapter";
import { firebaseAdapter, firebaseConfigurado } from "./firebase-adapter";
import type { ColecaoNome, DBAdapter, EventoAuditoria, Registro } from "./types";

export const db: DBAdapter = firebaseConfigurado ? firebaseAdapter : localAdapter;
export const modoBanco = db.nome;

export const novoId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase();

export function registrarAuditoria(evento: Omit<EventoAuditoria, "id" | "data">) {
  const item: EventoAuditoria = { ...evento, id: novoId(), data: new Date().toISOString() };
  void db.salvar("auditoria", item as unknown as Registro);
}

export function useColecao<T extends Registro>(colecao: ColecaoNome) {
  const [dados, setDados] = useState<T[]>([]);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(() => {
    void db.listar<T>(colecao).then((d) => {
      setDados(d);
      setCarregando(false);
    });
  }, [colecao]);

  useEffect(() => {
    recarregar();
    return db.observar(colecao, recarregar);
  }, [colecao, recarregar]);

  const salvar = useCallback(
    async (registro: T, usuario = "sistema") => {
      const existente = dados.some((d) => d.id === registro.id);
      const registroComAutor = {
        ...registro,
        criadoPor: (registro as Record<string, unknown>)["criadoPor"] ?? usuario,
        atualizadoPor: usuario,
      };
      await db.salvar(colecao, registroComAutor as T);
      registrarAuditoria({
        colecao,
        registroId: registro.id,
        acao: existente ? "alterar" : "criar",
        usuario,
      });
      return registro;
    },
    [colecao, dados],
  );

  const remover = useCallback(
    async (id: string, usuario = "sistema") => {
      await db.remover(colecao, id);
      registrarAuditoria({ colecao, registroId: id, acao: "excluir", usuario });
    },
    [colecao],
  );

  return { dados, carregando, salvar, remover, recarregar };
}

export type { ColecaoNome, EventoAuditoria };