import { z } from "zod";

/**
 * Fonte única de verdade de validação.
 * Estes schemas são usados no formulário (frontend) E nas server functions
 * (backend), garantindo que o servidor NUNCA confie no cliente.
 */

const onlyDigits = (v: string) => v.replace(/\D/g, "");

export const cpfCnpjSchema = z
  .string()
  .trim()
  .min(11, "CPF/CNPJ inválido")
  .refine((v) => [11, 14].includes(onlyDigits(v).length), "CPF/CNPJ inválido")
  .refine((v) => {
    const d = onlyDigits(v);
    return d.length === 11 ? isValidCPF(d) : isValidCNPJ(d);
  }, "CPF/CNPJ inválido");

export function isValidCPF(cpf: string) {
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let d1 = ((sum * 10) % 11) % 10;
  if (d1 !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  const d2 = ((sum * 10) % 11) % 10;
  return d2 === Number(cpf[10]);
}

export function isValidCNPJ(cnpj: string) {
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (len: number) => {
    let pos = len - 7;
    let sum = 0;
    for (let i = 0; i < len; i++) {
      sum += Number(cnpj[i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
}

export const phoneSchema = z
  .string()
  .trim()
  .refine((v) => [10, 11].includes(onlyDigits(v).length), "Telefone inválido");

export const placaSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ""))
  .refine(
    (v) => /^[A-Z]{3}[0-9]{4}$/.test(v) || /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(v),
    "Placa inválida (ABC1234 ou ABC1D23)",
  );

export const clienteSchema = z.object({
  id: z.string().optional(),
  nome: z.string().trim().min(3, "Informe o nome completo").max(120),
  cpfCnpj: cpfCnpjSchema.optional().or(z.literal("")),
  telefone: phoneSchema,
  email: z.string().trim().email("E-mail inválido").max(160).optional().or(z.literal("")),
  cep: z.string().trim().max(9).optional().or(z.literal("")),
  endereco: z.string().trim().max(180).optional().or(z.literal("")),
  numero: z.string().trim().max(12).optional().or(z.literal("")),
  bairro: z.string().trim().max(80).optional().or(z.literal("")),
  cidade: z.string().trim().max(80).optional().or(z.literal("")),
  uf: z.string().trim().max(2).optional().or(z.literal("")),
  observacoes: z.string().trim().max(1000).optional().or(z.literal("")),
  consentimentoLgpd: z.boolean().default(true),
  criadoEm: z.string().optional(),
});
export type Cliente = z.infer<typeof clienteSchema> & { id: string; criadoEm: string };

export const veiculoSchema = z.object({
  id: z.string().optional(),
  clienteId: z.string().min(1, "Selecione o cliente"),
  placa: placaSchema,
  marca: z.string().trim().min(1, "Informe a marca").max(40),
  modelo: z.string().trim().min(1, "Informe o modelo").max(80),
  ano: z.coerce.number().int().min(1900).max(new Date().getFullYear() + 1),
  cor: z.string().trim().max(30).optional().or(z.literal("")),
  motor: z.string().trim().max(20).optional().or(z.literal("")),
  chassi: z.string().trim().max(30).optional().or(z.literal("")),
  km: z.coerce.number().int().min(0).max(3_000_000).default(0),
  observacoes: z.string().trim().max(1000).optional().or(z.literal("")),
  criadoEm: z.string().optional(),
});
export type Veiculo = z.infer<typeof veiculoSchema> & { id: string; criadoEm: string };

export const itemSchema = z.object({
  id: z.string(),
  tipo: z.enum(["servico", "peca"]),
  descricao: z.string().trim().min(2, "Descrição obrigatória").max(160),
  quantidade: z.coerce.number().min(0.01, "Qtd inválida").max(9999),
  valorUnitario: z.coerce.number().min(0, "Valor inválido").max(1_000_000),
  custoUnitario: z.coerce.number().min(0).max(1_000_000).default(0),
  desconto: z.coerce.number().min(0).max(1_000_000).default(0),
  origem: z.enum(["estoque", "autopecas", "cliente"]).default("estoque"),
  mecanicoId: z.string().optional().or(z.literal("")),
  aprovado: z.boolean().default(true),
  pecaId: z.string().optional().or(z.literal("")),
});
export type ItemOS = z.infer<typeof itemSchema>;

export const osStatus = [
  "Agendado",
  "Aguardando atendimento",
  "Em andamento",
  "Aguardando peça/aprovação",
  "Finalizado",
  "Entregue/Fechado",
] as const;
export type OSStatus = (typeof osStatus)[number];

export const checklistSchema = z.object({
  hodometro: z.coerce.number().min(0).default(0),
  combustivel: z.string().default("1/2 (50%)"),
  itens: z.record(z.string(), z.string()).default({}),
  observacoes: z.string().max(1000).default(""),
  fotos: z.array(z.string()).max(15, "Máximo de 15 fotos").default([]),
});
export type Checklist = z.infer<typeof checklistSchema>;

export const ordemServicoSchema = z.object({
  id: z.string().optional(),
  numero: z.string().optional(),
  tipo: z.enum(["orcamento", "os"]).default("os"),
  clienteId: z.string().min(1, "Selecione o cliente"),
  veiculoId: z.string().min(1, "Selecione o veículo"),
  status: z.enum(osStatus).default("Aguardando atendimento"),
  aprovacao: z.enum(["Aguardando aprovação", "Aprovado", "Aprovado parcial", "Recusado"]).default(
    "Aguardando aprovação",
  ),
  prioridade: z.enum(["Baixa", "Média", "Alta"]).default("Média"),
  emissao: z.string(),
  previsao: z.string().optional().or(z.literal("")),
  saida: z.string().optional().or(z.literal("")),
  km: z.coerce.number().min(0).default(0),
  reclamacao: z.string().trim().max(2000).default(""),
  diagnostico: z.string().trim().max(2000).default(""),
  observacoes: z.string().trim().max(2000).default(""),
  garantiaDias: z.coerce.number().int().min(0).max(3650).default(90),
  mecanicoId: z.string().optional().or(z.literal("")),
  itens: z.array(itemSchema).default([]),
  descontoGeral: z.coerce.number().min(0).default(0),
  checklistEntrada: checklistSchema.optional(),
  checklistSaida: checklistSchema.optional(),
  criadoEm: z.string().optional(),
  criadoPor: z.string().optional(),
});
export type OrdemServico = z.infer<typeof ordemServicoSchema> & {
  id: string;
  numero: string;
  criadoEm: string;
};

export const pecaSchema = z.object({
  id: z.string().optional(),
  nome: z.string().trim().min(2, "Informe o nome").max(120),
  codigo: z.string().trim().max(40).optional().or(z.literal("")),
  marca: z.string().trim().max(60).optional().or(z.literal("")),
  fornecedor: z.string().trim().max(80).optional().or(z.literal("")),
  custo: z.coerce.number().min(0).default(0),
  precoVenda: z.coerce.number().min(0).default(0),
  quantidade: z.coerce.number().min(0).default(0),
  estoqueMinimo: z.coerce.number().min(0).default(1),
  localizacao: z.string().trim().max(40).optional().or(z.literal("")),
  observacoes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type Peca = z.infer<typeof pecaSchema> & { id: string };

export const servicoBaseSchema = z.object({
  id: z.string().optional(),
  nome: z.string().trim().min(2, "Informe o serviço").max(120),
  valorPadrao: z.coerce.number().min(0).default(0),
  tempoEstimado: z.coerce.number().min(0).default(1),
});
export type ServicoBase = z.infer<typeof servicoBaseSchema> & { id: string };

export const compraStatus = [
  "A comprar",
  "Pedido realizado",
  "Aguardando entrega",
  "Recebida",
  "Reservada",
  "Instalada",
  "Devolvida/Cancelada",
] as const;

export const compraSchema = z.object({
  id: z.string().optional(),
  osId: z.string().optional().or(z.literal("")),
  descricao: z.string().trim().min(2, "Descrição obrigatória").max(160),
  fornecedor: z.string().trim().min(2, "Informe o fornecedor").max(80),
  quantidade: z.coerce.number().min(0.01).default(1),
  valorPago: z.coerce.number().min(0).default(0),
  valorVenda: z.coerce.number().min(0).default(0),
  status: z.enum(compraStatus).default("A comprar"),
  dataSolicitacao: z.string(),
  previsaoEntrega: z.string().optional().or(z.literal("")),
  nota: z.string().trim().max(60).optional().or(z.literal("")),
  paraEstoque: z.boolean().default(false),
});
export type Compra = z.infer<typeof compraSchema> & { id: string };

export const lancamentoSchema = z.object({
  id: z.string().optional(),
  tipo: z.enum(["receber", "pagar"]),
  descricao: z.string().trim().min(2, "Descrição obrigatória").max(160),
  valor: z.coerce.number().min(0.01, "Valor inválido"),
  vencimento: z.string().min(1, "Informe o vencimento"),
  pagoEm: z.string().optional().or(z.literal("")),
  formaPagamento: z
    .enum(["Dinheiro", "PIX", "Débito", "Crédito", "Boleto", "Transferência"])
    .default("PIX"),
  categoria: z.string().trim().max(60).default("Serviços"),
  osId: z.string().optional().or(z.literal("")),
  clienteId: z.string().optional().or(z.literal("")),
});
export type Lancamento = z.infer<typeof lancamentoSchema> & { id: string };

export const agendamentoSchema = z.object({
  id: z.string().optional(),
  nome: z.string().trim().min(3, "Informe o nome completo").max(120),
  cpfCnpj: cpfCnpjSchema.optional().or(z.literal("")),
  telefone: phoneSchema,
  email: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
  endereco: z.string().trim().max(180).optional().or(z.literal("")),
  placa: placaSchema,
  marca: z.string().trim().min(1, "Informe a marca").max(40),
  modelo: z.string().trim().min(1, "Informe o modelo").max(80),
  ano: z.coerce.number().int().min(1900).max(new Date().getFullYear()),
  km: z.coerce.number().int().min(0).default(0),
  servico: z.string().trim().min(2, "Selecione o serviço").max(120),
  descricao: z.string().trim().max(1000).optional().or(z.literal("")),
  data: z.string().min(1, "Escolha a data"),
  hora: z.string().min(1, "Escolha o horário"),
  status: z.enum(["Pendente", "Confirmado", "Cancelado", "Convertido"]).default("Pendente"),
  consentimentoLgpd: z
    .boolean()
    .refine((v) => v === true, "É necessário aceitar o uso dos dados (LGPD)"),
  criadoEm: z.string().optional(),
});
export type Agendamento = z.infer<typeof agendamentoSchema> & { id: string; criadoEm: string };

export const perfis = ["Administrador", "Responsável técnico", "Administrativo", "Mecânico"] as const;
export type Perfil = (typeof perfis)[number];

export const usuarioSchema = z.object({
  id: z.string().optional(),
  nome: z.string().trim().min(3, "Informe o nome").max(120),
  email: z.string().trim().email("E-mail inválido"),
  perfil: z.enum(perfis).default("Mecânico"),
  ativo: z.boolean().default(true),
});
export type Usuario = z.infer<typeof usuarioSchema> & { id: string };

export const configSchema = z.object({
  diasAtendimento: z.array(z.number().min(0).max(6)).default([1, 2, 3, 4, 5, 6]),
  horaInicio: z.string().default("08:00"),
  horaFim: z.string().default("18:00"),
  intervaloMinutos: z.coerce.number().int().min(15).max(240).default(60),
  limitePorHorario: z.coerce.number().int().min(1).max(20).default(2),
  diasBloqueados: z.array(z.string()).default([]),
  servicos: z.array(z.string()).default([]),
});
export type Config = z.infer<typeof configSchema>;
