import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  agendamentoSchema,
  clienteSchema,
  ordemServicoSchema,
  placaSchema,
  veiculoSchema,
} from "../schemas";

/**
 * BACKEND — ESTRUTURA PRONTA (sessão 1: sem chaves do Firebase ainda).
 *
 * Princípio: o servidor NUNCA confia no frontend.
 * Toda função aqui:
 *  1. valida a entrada com o MESMO schema Zod usado na tela;
 *  2. verifica sessão e permissão (verificarPermissao);
 *  3. recalcula valores no servidor (nunca aceita totais vindos do cliente);
 *  4. grava auditoria (quem, o quê, quando) — exigência da LGPD.
 *
 * Na sessão 2, o corpo de cada handler passa a usar firebase-admin
 * (Firestore + Auth com custom claims por perfil).
 */

type Contexto = { uid: string; perfil: string };

async function autenticar(): Promise<Contexto> {
  // TODO(sessão 2): validar o ID token do Firebase Auth vindo no header.
  // const decoded = await getAuth().verifyIdToken(token)
  return { uid: "pendente", perfil: "Administrador" };
}

function verificarPermissao(ctx: Contexto, permitidos: string[]) {
  if (ctx.perfil === "Administrador") return;
  if (!permitidos.includes(ctx.perfil)) {
    throw new Error("Sem permissão para esta ação");
  }
}

function naoImplementado(nome: string): never {
  throw new Error(
    `[${nome}] Backend validado, aguardando conexão com o Firebase (chaves não configuradas).`,
  );
}

export const salvarCliente = createServerFn({ method: "POST" })
  .inputValidator((data) => clienteSchema.parse(data))
  .handler(async ({ data }) => {
    const ctx = await autenticar();
    verificarPermissao(ctx, ["Administrativo", "Responsável técnico"]);
    void data;
    return naoImplementado("salvarCliente");
  });

export const salvarVeiculo = createServerFn({ method: "POST" })
  .inputValidator((data) => veiculoSchema.parse(data))
  .handler(async ({ data }) => {
    const ctx = await autenticar();
    verificarPermissao(ctx, ["Administrativo", "Responsável técnico"]);
    void data;
    return naoImplementado("salvarVeiculo");
  });

export const salvarOrdemServico = createServerFn({ method: "POST" })
  .inputValidator((data) => ordemServicoSchema.parse(data))
  .handler(async ({ data }) => {
    const ctx = await autenticar();
    verificarPermissao(ctx, ["Administrativo", "Responsável técnico", "Mecânico"]);
    // Totais SEMPRE recalculados aqui, ignorando qualquer total enviado pelo cliente.
    void data;
    return naoImplementado("salvarOrdemServico");
  });

export const criarAgendamentoPublico = createServerFn({ method: "POST" })
  .inputValidator((data) => agendamentoSchema.parse(data))
  .handler(async ({ data }) => {
    // Rota pública: sem sessão, mas com validação forte + limite por horário
    // conferido no servidor (o cliente não escolhe horário indisponível).
    void data;
    return naoImplementado("criarAgendamentoPublico");
  });

export const consultarPlaca = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ placa: placaSchema }).parse(data))
  .handler(async ({ data }) => {
    // TODO(sessão 2): chamar a API oficial/autorizada com a chave em process.env,
    // registrar a consulta (LGPD: finalidade, usuário, data) e aplicar cache de
    // 90 dias por placa para reduzir custo por consulta.
    void data;
    return naoImplementado("consultarPlaca");
  });

export const exportarDadosCliente = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ clienteId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const ctx = await autenticar();
    verificarPermissao(ctx, []);
    void data;
    return naoImplementado("exportarDadosCliente");
  });

export const excluirDadosCliente = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ clienteId: z.string().min(1), motivo: z.string().min(5) }).parse(data),
  )
  .handler(async ({ data }) => {
    const ctx = await autenticar();
    verificarPermissao(ctx, []); // apenas Administrador (LGPD art. 18)
    void data;
    return naoImplementado("excluirDadosCliente");
  });
