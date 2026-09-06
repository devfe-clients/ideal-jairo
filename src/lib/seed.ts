import { escreverSync, lerSync } from "./db/local-adapter";
import type {
  Agendamento,
  Cliente,
  Compra,
  Config,
  Lancamento,
  OrdemServico,
  Peca,
  ServicoBase,
  Usuario,
  Veiculo,
} from "./schemas";

const hoje = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const maisDias = (n: number) => {
  const d = new Date(hoje);
  d.setDate(d.getDate() + n);
  return iso(d);
};

export function semear() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem("ideal-jairo:semeado") === "2") return;

  const clientes: Cliente[] = [
    {
      id: "CLI1",
      nome: "Arthur Xavier",
      cpfCnpj: "390.533.447-05",
      telefone: "(13) 97427-9750",
      email: "arthur@email.com",
      cep: "11704-230",
      endereco: "R. Vicente Ítalo Feola",
      numero: "560",
      bairro: "Cidade Ocian",
      cidade: "Praia Grande",
      uf: "SP",
      observacoes: "",
      consentimentoLgpd: true,
      criadoEm: new Date().toISOString(),
    },
    {
      id: "CLI2",
      nome: "Marcela Ferreira",
      cpfCnpj: "111.444.777-35",
      telefone: "(13) 99123-4455",
      email: "",
      cep: "",
      endereco: "Av. Presidente Kennedy",
      numero: "1200",
      bairro: "Guilhermina",
      cidade: "Praia Grande",
      uf: "SP",
      observacoes: "",
      consentimentoLgpd: true,
      criadoEm: new Date().toISOString(),
    },
  ];

  const veiculos: Veiculo[] = [
    {
      id: "VEI1",
      clienteId: "CLI1",
      placa: "DMA8D96",
      marca: "GM - Chevrolet",
      modelo: "CELTA 5 PORTAS SUPER",
      ano: 2003,
      cor: "PRATA",
      motor: "1.0",
      chassi: "17525",
      km: 210085,
      observacoes: "",
      criadoEm: new Date().toISOString(),
    },
    {
      id: "VEI2",
      clienteId: "CLI2",
      placa: "FKR2A11",
      marca: "Fiat",
      modelo: "ARGO DRIVE 1.3",
      ano: 2021,
      cor: "BRANCO",
      motor: "1.3",
      chassi: "88231",
      km: 48210,
      observacoes: "",
      criadoEm: new Date().toISOString(),
    },
  ];

  const ordens: OrdemServico[] = [
    {
      id: "OS1",
      numero: "OS-2026-09-001",
      tipo: "os",
      clienteId: "CLI1",
      veiculoId: "VEI1",
      status: "Entregue/Fechado",
      aprovacao: "Aprovado",
      prioridade: "Média",
      emissao: iso(hoje),
      previsao: iso(hoje),
      saida: iso(hoje),
      km: 210085,
      reclamacao: "Barulho na roda dianteira ao fazer curva.",
      diagnostico: "Foi necessário realizar a troca do rolamento dianteiro com cubo.",
      observacoes: "",
      garantiaDias: 90,
      mecanicoId: "USR2",
      descontoGeral: 0,
      itens: [
        {
          id: "I1",
          tipo: "servico",
          descricao: "Mão de obra — troca de rolamento dianteiro",
          quantidade: 1,
          valorUnitario: 150,
          custoUnitario: 0,
          desconto: 0,
          origem: "estoque",
          mecanicoId: "USR2",
          aprovado: true,
          pecaId: "",
        },
        {
          id: "I2",
          tipo: "peca",
          descricao: "Rolamento com cubo",
          quantidade: 1,
          valorUnitario: 230,
          custoUnitario: 155,
          desconto: 0,
          origem: "autopecas",
          mecanicoId: "",
          aprovado: true,
          pecaId: "",
        },
      ],
      checklistEntrada: {
        hodometro: 210082,
        combustivel: "1/2 (50%)",
        itens: { "Lataria Frontal": "Arranhões", "Lat. Direita": "Arranhões" },
        observacoes: "Tapetes presentes.",
        fotos: [],
      },
      criadoEm: new Date().toISOString(),
      criadoPor: "Jairo Alves de Oliveira",
    },
    {
      id: "OS2",
      numero: "ORC-2026-09-002",
      tipo: "orcamento",
      clienteId: "CLI2",
      veiculoId: "VEI2",
      status: "Aguardando peça/aprovação",
      aprovacao: "Aguardando aprovação",
      prioridade: "Alta",
      emissao: iso(hoje),
      previsao: maisDias(2),
      saida: "",
      km: 48210,
      reclamacao: "Revisão de 50 mil km e troca de pastilhas.",
      diagnostico: "",
      observacoes: "",
      garantiaDias: 90,
      mecanicoId: "USR2",
      descontoGeral: 0,
      itens: [
        {
          id: "I3",
          tipo: "servico",
          descricao: "Revisão completa 50.000 km",
          quantidade: 1,
          valorUnitario: 320,
          custoUnitario: 0,
          desconto: 20,
          origem: "estoque",
          mecanicoId: "USR2",
          aprovado: true,
          pecaId: "",
        },
        {
          id: "I4",
          tipo: "peca",
          descricao: "Jogo de pastilhas de freio dianteiras",
          quantidade: 1,
          valorUnitario: 210,
          custoUnitario: 128,
          desconto: 0,
          origem: "estoque",
          mecanicoId: "",
          aprovado: false,
          pecaId: "PEC2",
        },
        {
          id: "I5",
          tipo: "peca",
          descricao: "Óleo 5W30 sintético (litro)",
          quantidade: 4,
          valorUnitario: 52,
          custoUnitario: 33,
          desconto: 0,
          origem: "estoque",
          mecanicoId: "",
          aprovado: true,
          pecaId: "PEC1",
        },
      ],
      criadoEm: new Date().toISOString(),
      criadoPor: "Jairo Alves de Oliveira",
    },
  ];

  const pecas: Peca[] = [
    {
      id: "PEC1",
      nome: "Óleo 5W30 sintético (litro)",
      codigo: "OL-5W30",
      marca: "Mobil",
      fornecedor: "Autopeças Ocian",
      custo: 33,
      precoVenda: 52,
      quantidade: 18,
      estoqueMinimo: 8,
      localizacao: "Prateleira A2",
      observacoes: "",
    },
    {
      id: "PEC2",
      nome: "Jogo de pastilhas de freio dianteiras",
      codigo: "PF-1201",
      marca: "Cobreq",
      fornecedor: "Autopeças Ocian",
      custo: 128,
      precoVenda: 210,
      quantidade: 2,
      estoqueMinimo: 3,
      localizacao: "Prateleira B1",
      observacoes: "",
    },
    {
      id: "PEC3",
      nome: "Filtro de óleo",
      codigo: "FO-330",
      marca: "Tecfil",
      fornecedor: "Rei das Peças",
      custo: 22,
      precoVenda: 45,
      quantidade: 6,
      estoqueMinimo: 4,
      localizacao: "Prateleira A1",
      observacoes: "",
    },
  ];

  const servicos: ServicoBase[] = [
    { id: "SRV1", nome: "Troca de óleo e filtros", valorPadrao: 120, tempoEstimado: 1 },
    { id: "SRV2", nome: "Revisão completa", valorPadrao: 320, tempoEstimado: 3 },
    { id: "SRV3", nome: "Troca de pastilhas de freio", valorPadrao: 180, tempoEstimado: 2 },
    { id: "SRV4", nome: "Troca de rolamento com cubo", valorPadrao: 150, tempoEstimado: 2 },
    { id: "SRV5", nome: "Diagnóstico eletrônico (scanner)", valorPadrao: 130, tempoEstimado: 1 },
    { id: "SRV6", nome: "Alinhamento e balanceamento", valorPadrao: 140, tempoEstimado: 1 },
  ];

  const compras: Compra[] = [
    {
      id: "CMP1",
      osId: "OS1",
      descricao: "Rolamento com cubo",
      fornecedor: "Autopeças Ocian",
      quantidade: 1,
      valorPago: 155,
      valorVenda: 230,
      status: "Instalada",
      dataSolicitacao: maisDias(-3),
      previsaoEntrega: maisDias(-2),
      nota: "NF 10231",
      paraEstoque: false,
    },
    {
      id: "CMP2",
      osId: "",
      descricao: "Jogo de pastilhas de freio dianteiras",
      fornecedor: "Rei das Peças",
      quantidade: 3,
      valorPago: 384,
      valorVenda: 630,
      status: "Pedido realizado",
      dataSolicitacao: iso(hoje),
      previsaoEntrega: maisDias(3),
      nota: "",
      paraEstoque: true,
    },
  ];

  const lancamentos: Lancamento[] = [
    {
      id: "LAN1",
      tipo: "receber",
      descricao: "OS-2026-09-001 — Arthur Xavier",
      valor: 380,
      vencimento: iso(hoje),
      pagoEm: iso(hoje),
      formaPagamento: "PIX",
      categoria: "Serviços",
      osId: "OS1",
      clienteId: "CLI1",
    },
    {
      id: "LAN2",
      tipo: "pagar",
      descricao: "Autopeças Ocian — rolamento com cubo",
      valor: 155,
      vencimento: maisDias(5),
      pagoEm: "",
      formaPagamento: "Boleto",
      categoria: "Peças",
      osId: "OS1",
      clienteId: "",
    },
    {
      id: "LAN3",
      tipo: "pagar",
      descricao: "Energia elétrica",
      valor: 410,
      vencimento: maisDias(9),
      pagoEm: "",
      formaPagamento: "Boleto",
      categoria: "Despesas fixas",
      osId: "",
      clienteId: "",
    },
  ];

  const agendamentos: Agendamento[] = [
    {
      id: "AGD1",
      nome: "Marcela Ferreira",
      cpfCnpj: "111.444.777-35",
      telefone: "(13) 99123-4455",
      email: "",
      endereco: "Av. Presidente Kennedy, 1200",
      placa: "FKR2A11",
      marca: "Fiat",
      modelo: "ARGO DRIVE 1.3",
      ano: 2021,
      km: 48210,
      servico: "Revisão completa",
      descricao: "Barulho leve ao frear.",
      data: maisDias(1),
      hora: "09:00",
      status: "Confirmado",
      consentimentoLgpd: true,
      criadoEm: new Date().toISOString(),
    },
    {
      id: "AGD2",
      nome: "Rogério Lima",
      cpfCnpj: "390.533.447-05",
      telefone: "(13) 98812-7766",
      email: "",
      endereco: "",
      placa: "GHT4C21",
      marca: "VW",
      modelo: "GOL 1.6",
      ano: 2016,
      km: 121300,
      servico: "Troca de óleo e filtros",
      descricao: "",
      data: maisDias(2),
      hora: "14:00",
      status: "Pendente",
      consentimentoLgpd: true,
      criadoEm: new Date().toISOString(),
    },
  ];

  const usuarios: Usuario[] = [
    { id: "USR1", nome: "Jairo Alves de Oliveira", email: "jairo@idealjairo.com.br", perfil: "Administrador", ativo: true },
    { id: "USR2", nome: "Diego Souza", email: "diego@idealjairo.com.br", perfil: "Mecânico", ativo: true },
    { id: "USR3", nome: "Patrícia Nunes", email: "patricia@idealjairo.com.br", perfil: "Administrativo", ativo: true },
  ];

  const config: Config & { id: string } = {
    id: "CONFIG",
    diasAtendimento: [1, 2, 3, 4, 5, 6],
    horaInicio: "08:00",
    horaFim: "18:00",
    intervaloMinutos: 60,
    limitePorHorario: 2,
    diasBloqueados: [],
    servicos: servicos.map((s) => s.nome),
  };

  const set = <T,>(nome: Parameters<typeof escreverSync>[0], dados: T[]) => {
    if (lerSync(nome).length === 0) escreverSync(nome, dados);
  };

  set("clientes", clientes);
  set("veiculos", veiculos);
  set("ordens", ordens);
  set("pecas", pecas);
  set("servicos", servicos);
  set("compras", compras);
  set("lancamentos", lancamentos);
  set("agendamentos", agendamentos);
  set("usuarios", usuarios);
  set("config", [config]);

  window.localStorage.setItem("ideal-jairo:semeado", "2");
}
