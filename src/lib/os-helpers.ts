import { novoId } from "./db";
import type { Agendamento, Cliente, Lancamento, OrdemServico, Veiculo } from "./schemas";
import { totaisOS } from "./calc";

export function proximoNumero(ordens: OrdemServico[], tipo: "os" | "orcamento") {
  const prefixo = tipo === "os" ? "OS" : "ORC";
  const agora = new Date();
  const base = `${prefixo}-${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
  const seq =
    ordens.filter((o) => o.numero?.startsWith(base)).length + 1;
  return `${base}-${String(seq).padStart(3, "0")}`;
}

export function novaOrdem(
  ordens: OrdemServico[],
  tipo: "os" | "orcamento",
  clienteId: string,
  veiculoId: string,
  km = 0,
  criadoPor = "sistema",
): OrdemServico {
  const hoje = new Date().toISOString().slice(0, 10);
  return {
    id: novoId(),
    numero: proximoNumero(ordens, tipo),
    tipo,
    clienteId,
    veiculoId,
    status: tipo === "os" ? "Aguardando atendimento" : "Agendado",
    aprovacao: tipo === "os" ? "Aprovado" : "Aguardando aprovação",
    prioridade: "Média",
    emissao: hoje,
    previsao: hoje,
    saida: "",
    km,
    reclamacao: "",
    diagnostico: "",
    observacoes: "",
    garantiaDias: 90,
    mecanicoId: "",
    itens: [],
    descontoGeral: 0,
    criadoEm: new Date().toISOString(),
    criadoPor,
  };
}

/**contas a receber criada automaticamente ao finalizar a OS. */
export function contaReceberDaOS(os: OrdemServico): Lancamento {
  return {
    id: novoId(),
    tipo: "receber",
    descricao: `${os.numero} — serviços e peças`,
    valor: totaisOS(os, true).total,
    valorPago: 0,
    vencimento: new Date().toISOString().slice(0, 10),
    pagoEm: "",
    formaPagamento: "PIX",
    categoria: "Serviços",
    observacao: "",
    osId: os.id,
    clienteId: os.clienteId,
  };
}

/**
 *contas a pagar de mão de obra geradas automaticamente ao finalizar a OS.
 *retorna um lançamento por mecânico distinto que tem serviços na OS.
 */
export function contasPagarMaoDeObra(
  os: OrdemServico,
  mecanicos: { id: string; nome: string }[],
): Lancamento[] {
  const hoje = new Date().toISOString().slice(0, 10);
  const servicosPorMecanico = new Map<string, number>();

  for (const item of os.itens) {
    if (item.tipo !== "servico") continue;
    const mecId = item.mecanicoId || os.mecanicoId || "";
    if (!mecId) continue;
    const total = item.valorUnitario * item.quantidade - item.desconto;
    servicosPorMecanico.set(mecId, (servicosPorMecanico.get(mecId) ?? 0) + total);
  }

  const lancamentos: Lancamento[] = [];
  for (const [mecId, valor] of servicosPorMecanico) {
    if (valor <= 0) continue;
    const mecanico = mecanicos.find((m) => m.id === mecId);
    if (!mecanico) continue;
    lancamentos.push({
      id: novoId(),
      tipo: "pagar",
      descricao: `${os.numero} — mão de obra · ${mecanico.nome}`,
      valor,
      valorPago: 0,
      vencimento: hoje,
      pagoEm: "",
      formaPagamento: "PIX",
      categoria: "Mão de obra",
      observacao: "",
      osId: os.id,
      clienteId: "",
    });
  }
  return lancamentos;
}

export function mensagemOrcamento(
  os: OrdemServico,
  cliente?: Cliente,
  veiculo?: Veiculo,
): string {
  const t = totaisOS(os, true);
  const linhas = os.itens
    .filter((i) => i.aprovado)
    .map((i) => `• ${i.descricao} — ${i.quantidade}x`);
  return [
    `Olá ${cliente?.nome?.split(" ")[0] ?? ""}! Oficina Ideal Jairo.`,
    `Orçamento ${os.numero} — ${veiculo?.marca ?? ""} ${veiculo?.modelo ?? ""} (${veiculo?.placa ?? ""}).`,
    "",
    ...linhas,
    "",
    `Peças: R$ ${t.totalPecas.toFixed(2)}`,
    `Mão de obra: R$ ${t.totalServicos.toFixed(2)}`,
    `Total: R$ ${t.total.toFixed(2)}`,
    "",
    "Responsável técnico: Jairo Alves de Oliveira.",
    "Podemos aprovar o serviço?",
  ].join("\n");
}

export function mensagemPronto(os: OrdemServico, cliente?: Cliente, veiculo?: Veiculo) {
  return `Olá ${cliente?.nome?.split(" ")[0] ?? ""}! Seu ${veiculo?.modelo ?? "veículo"} (${veiculo?.placa ?? ""}) está pronto para retirada. OS ${os.numero}. Oficina Ideal Jairo.`;
}

export function dadosDoAgendamento(
  agendamento: Agendamento,
  clientes: Cliente[],
  veiculos: Veiculo[],
) {
  const cliente = clientes.find(
    (c) =>
              (c.cpfCnpj ?? "").replace(/\D/g, "") === (agendamento.cpfCnpj ?? "").replace(/\D/g, "") ||
      c.telefone.replace(/\D/g, "") === agendamento.telefone.replace(/\D/g, ""),
  );
  const veiculo = veiculos.find((v) => v.placa === agendamento.placa);
  return { cliente, veiculo };
}
