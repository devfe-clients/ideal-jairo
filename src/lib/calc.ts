import type { ItemOS, OrdemServico } from "./schemas";

export const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(v) ? v : 0,
  );

export const dataBR = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
};

export const itemTotal = (i: ItemOS) =>
  Math.max(0, i.quantidade * i.valorUnitario - (i.desconto || 0));

export const itemCusto = (i: ItemOS) => i.quantidade * (i.custoUnitario || 0);

export type Totais = {
  totalServicos: number;
  totalPecas: number;
  descontoItens: number;
  descontoGeral: number;
  subtotal: number;
  total: number;
  custoPecas: number;
  margemPecas: number;
  margemServicos: number;
  margemTotal: number;
};

/** Cálculo automático — peças e mão de obra sempre separados. */
export function calcularTotais(
  itens: ItemOS[],
  descontoGeral = 0,
  apenasAprovados = false,
): Totais {
  const lista = apenasAprovados ? itens.filter((i) => i.aprovado) : itens;
  const servicos = lista.filter((i) => i.tipo === "servico");
  const pecas = lista.filter((i) => i.tipo === "peca");

  const totalServicos = servicos.reduce((s, i) => s + itemTotal(i), 0);
  const totalPecas = pecas.reduce((s, i) => s + itemTotal(i), 0);
  const descontoItens = lista.reduce((s, i) => s + (i.desconto || 0), 0);
  const custoPecas = pecas
    .filter((i) => i.origem !== "cliente")
    .reduce((s, i) => s + itemCusto(i), 0);
  const subtotal = totalServicos + totalPecas;
  const total = Math.max(0, subtotal - (descontoGeral || 0));

  const margemPecas = totalPecas - custoPecas;
  const margemServicos = totalServicos;

  return {
    totalServicos,
    totalPecas,
    descontoItens,
    descontoGeral: descontoGeral || 0,
    subtotal,
    total,
    custoPecas,
    margemPecas,
    margemServicos,
    margemTotal: margemPecas + margemServicos - (descontoGeral || 0),
  };
}

export const totaisOS = (os: OrdemServico, apenasAprovados = false) =>
  calcularTotais(os.itens, os.descontoGeral, apenasAprovados);

export const soDigitos = (v: string) => (v || "").replace(/\D/g, "");

export const formatarTelefone = (v: string) => {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d{0,4})(\d{0,4})/, (_, a, b, c) =>
      [a && `(${a}`, a.length === 2 ? ") " : "", b, c && `-${c}`].filter(Boolean).join(""),
    );
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
};

export const formatarPlaca = (v: string) =>
  (v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);

export const formatarDoc = (v: string) => {
  const d = soDigitos(v).slice(0, 14);
  if (d.length <= 11)
    return d.replace(/(\d{3})(\d{3})?(\d{3})?(\d{2})?/, (_, a, b, c, e) =>
      [a, b && `.${b}`, c && `.${c}`, e && `-${e}`].filter(Boolean).join(""),
    );
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5");
};

export const linkWhatsApp = (telefone: string, mensagem: string) =>
  `https://wa.me/55${soDigitos(telefone)}?text=${encodeURIComponent(mensagem)}`;
