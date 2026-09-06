/** Contrato do banco de dados. Hoje: adaptador local. Amanhã: Firebase. */
export type Registro = { id: string; [k: string]: unknown };

export type ColecaoNome =
  | "clientes"
  | "veiculos"
  | "ordens"
  | "pecas"
  | "servicos"
  | "compras"
  | "lancamentos"
  | "agendamentos"
  | "usuarios"
  | "auditoria"
  | "config";

export interface DBAdapter {
  nome: string;
  listar<T extends Registro>(colecao: ColecaoNome): Promise<T[]>;
  salvar<T extends Registro>(colecao: ColecaoNome, registro: T): Promise<T>;
  remover(colecao: ColecaoNome, id: string): Promise<void>;
  observar(colecao: ColecaoNome, cb: () => void): () => void;
}

export type EventoAuditoria = {
  id: string;
  colecao: string;
  registroId: string;
  acao: "criar" | "alterar" | "excluir" | "aprovar" | "finalizar" | "consulta-placa";
  usuario: string;
  data: string;
  detalhe?: string;
};
