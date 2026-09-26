import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Camera,
  CheckCircle2,
  CheckSquare,
  Download,
  MessageCircle,
  Plus,
  Printer,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { ImpressaoOS } from "@/components/ImpressaoOS";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Campo, CampoArea, CampoTexto, Vazio } from "@/components/form-kit";
import { useColecao, novoId } from "@/lib/db";
import {
  itemSchema,
  osStatus,
  ordemServicoSchema,
  type Checklist,
  type Cliente,
  type ItemOS,
  type Lancamento,
  type OrdemServico,
  type Peca,
  type ServicoBase,
  type Usuario,
  type Veiculo,
} from "@/lib/schemas";
import { brl, linkWhatsApp, itemTotal, totaisOS } from "@/lib/calc";
import { contaReceberDaOS, contasPagarMaoDeObra, mensagemOrcamento, mensagemPronto, proximoNumero } from "@/lib/os-helpers";
import { ITENS_VISTORIA, NIVEIS_COMBUSTIVEL, OPCOES_VISTORIA, ITENS_INTERNOS } from "@/lib/empresa";
import { MAX_FOTOS, uploadFoto, comprimirFoto, validarArquivoFoto } from "@/lib/fotos";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/os_/$id")({
  head: () => ({
    meta: [
      { title: "Ordem de serviço | Oficina Ideal Jairo" },
      {
        name: "description",
        content:
          "Detalhe da ordem de serviço com peças, mão de obra, vistoria com fotos e cálculo automático dos valores.",
      },
      { property: "og:title", content: "Ordem de serviço | Oficina Ideal Jairo" },
      { property: "og:description", content: "Edição completa da OS da Oficina Ideal Jairo." },
    ],
  }),
  component: DetalheOS,
});

const checklistVazio: Checklist = {
  hodometro: 0,
  combustivel: "1/2 (50%)",
  itens: {},
  itensInternos: {},
  observacoes: "",
  fotos: [],
};

function DetalheOS() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { usuario, pode } = useAuth();
  const { dados: ordens, salvar: salvarOS } = useColecao<OrdemServico>("ordens");
  const { dados: clientes } = useColecao<Cliente>("clientes");
  const { dados: veiculos } = useColecao<Veiculo>("veiculos");
  const { dados: usuarios } = useColecao<Usuario>("usuarios");
  const { dados: pecas, salvar: salvarPeca } = useColecao<Peca>("pecas");
  const { dados: servicos } = useColecao<ServicoBase>("servicos");
  const { dados: lancamentos, salvar: salvarLancamento } = useColecao<Lancamento>("lancamentos");

  const original = ordens.find((o) => o.id === id);
  const [osState, setOS] = useState<OrdemServico | null>(null);
  const [dialogFinalizar, setDialogFinalizar] = useState(false);
  const [osParaFinalizar, setOsParaFinalizar] = useState<OrdemServico | null>(null);
const [modalPeca, setModalPeca] = useState<{
  itemId: string;
  nome: string;
  custo: string;
  venda: string;
} | null>(null);

async function criarPecaNoEstoque() {
  if (!modalPeca) return;
  const nova: Peca = {
    id: novoId(),
    nome: modalPeca.nome,
    codigo: "",
    marca: "",
    fornecedor: "",
    custo: Number(modalPeca.custo) || 0,
    precoVenda: Number(modalPeca.venda) || 0,
    quantidade: 0,
    estoqueMinimo: 1,
    localizacao: "",
    observacoes: "Criada automaticamente via OS.",
  };
  await salvarPeca(nova, usuario?.uid ?? "sistema");
  setOS((a) =>
    a
      ? {
          ...a,
          itens: a.itens.map((i) =>
            i.id === modalPeca.itemId
              ? {
                  ...i,
                  descricao: nova.nome,
                  valorUnitario: nova.precoVenda,
                  custoUnitario: nova.custo,
                  pecaId: nova.id,
                }
              : i,
          ),
        }
      : a,
  );
  toast.success(`Peça "${nova.nome}" criada no estoque.`);
  setModalPeca(null);
}

  useEffect(() => {
    if (original && !osState) setOS(structuredClone(original));
  }, [original, osState]);

  const cliente = clientes.find((c) => c.id === osState?.clienteId);
  const veiculo = veiculos.find((v) => v.id === osState?.veiculoId);
  const mecanicos = usuarios.filter((u) => u.perfil === "Mecânico" || u.perfil === "Responsável técnico");
  const totais = useMemo(
    () => (osState ? totaisOS(osState, osState.tipo === "orcamento") : null),
    [osState],
  );

  async function construirHtmlImpressao(): Promise<string> {
    if (!osState) return "";
    const os = osState;
    const numero = os.numero ?? "documento";
    const c = clientes.find((x) => x.id === os.clienteId);
    const v = veiculos.find((x) => x.id === os.veiculoId);
    const { brl, dataBR, formatarDoc, formatarTelefone, itemTotal, totaisOS } = await import("@/lib/calc");
    const { EMPRESA } = await import("@/lib/empresa");
    const t = totaisOS(os, os.tipo === "orcamento");
    const itens = os.tipo === "orcamento" ? os.itens.filter((i) => i.aprovado) : os.itens;
    const servicos = itens.filter((i) => i.tipo === "servico");
    const pecas = itens.filter((i) => i.tipo === "peca");
    const nomeMec = (id?: string) => usuarios.find((m) => m.id === id)?.nome ?? "";

    // Converte logo para base64
    let logoB64 = "";
    try {
      const r = await fetch("/logo-ideal-jairo.jpg");
      const blob = await r.blob();
      logoB64 = await new Promise<string>((res) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result as string);
        fr.readAsDataURL(blob);
      });
    } catch { /* sem logo */ }

    const linhaItem = (i: (typeof itens)[0]) => `
      <tr>
        <td>${i.descricao}${i.tipo === "servico" && nomeMec(i.mecanicoId) ? ` — mecânico: ${nomeMec(i.mecanicoId)}` : ""}</td>
        <td style="text-align:center">${i.quantidade}</td>
        <td style="text-align:right">${i.valorUnitario.toFixed(2)}</td>
        <td style="text-align:right">${i.desconto.toFixed(2)}</td>
        <td style="text-align:right">${itemTotal(i).toFixed(2)}</td>
      </tr>`;

    const tabela = (titulo: string, linhas: typeof itens) => linhas.length === 0 ? "" : `
      <table>
        <thead>
          <tr><th colspan="5" style="background:#000;color:#fff;text-align:left;padding:4px 8px;text-transform:uppercase">${titulo}</th></tr>
          <tr>
            <th style="text-align:left;border:1px solid #000;padding:4px 8px">Descrição</th>
            <th style="width:56px;border:1px solid #000;padding:4px 8px">Qtd</th>
            <th style="width:96px;border:1px solid #000;padding:4px 8px">V. Unit</th>
            <th style="width:80px;border:1px solid #000;padding:4px 8px">Desc.</th>
            <th style="width:96px;border:1px solid #000;padding:4px 8px">Total</th>
          </tr>
        </thead>
        <tbody>${linhas.map(linhaItem).join("")}</tbody>
      </table>`;

    const vistoria = (titulo: string, cv?: typeof os.checklistEntrada) => {
      if (!cv) return "";
      const marcados = Object.entries(cv.itens).filter(([, val]) => val);
      return `
      <div style="margin-top:10px;border:1px solid #000;padding:8px;font-size:11px">
        <p style="font-weight:bold;text-transform:uppercase">${titulo}${cv.dataHora ? ` <span style="font-weight:normal;font-size:10px;text-transform:none">— registrada em ${cv.dataHora}</span>` : ""}</p>
        <p>Hodômetro: ${cv.hodometro.toLocaleString("pt-BR")} km · Combustível: ${cv.combustivel}</p>
        ${marcados.length > 0 ? `<ul style="margin-top:4px;columns:2;list-style:none;padding:0">${marcados.map(([k, val]) => `<li><strong>${k}:</strong> ${val}</li>`).join("")}</ul>` : ""}
        ${cv.observacoes ? `<p style="margin-top:4px">Obs.: ${cv.observacoes}</p>` : ""}
        ${cv.fotos.length > 0 ? `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:8px">${cv.fotos.map((f, i) => `<img src="${f}" alt="foto ${i+1}" style="width:100%;height:80px;object-fit:cover;border-radius:4px">`).join("")}</div>` : ""}
      </div>`;
    };

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${numero}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#000;background:#fff;padding:16px;}
  @page{size:A4;margin:10mm;}
  @media print{body{padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
  table{width:100%;border-collapse:collapse;margin-top:10px;}
  td{border:1px solid #000;padding:4px 8px;}
  th{border:1px solid #000;padding:4px 8px;font-weight:bold;}
</style>
</head>
<body>
<div style="max-width:820px;margin:0 auto">

  <!-- Cabeçalho -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:10px">
      ${logoB64 ? `<img src="${logoB64}" style="width:56px;height:56px;border-radius:4px;object-fit:cover">` : ""}
      <div style="font-size:11px;line-height:1.5">
        <p style="font-size:14px;font-weight:bold;text-transform:uppercase">${EMPRESA.nome}</p>
        <p>CNPJ: ${EMPRESA.cnpj}</p>
        <p>${EMPRESA.endereco}</p>
        <p>${EMPRESA.bairro} - ${EMPRESA.cidade} - CEP: ${EMPRESA.cep}</p>
        <p>Tel: ${EMPRESA.telefone}</p>
      </div>
    </div>
    <div style="text-align:right;font-size:11px;line-height:1.5">
      <p style="font-size:14px;font-weight:bold;text-transform:uppercase">${os.tipo === "os" ? "Ordem de Serviço" : "Orçamento"}</p>
      <p style="font-weight:bold">Nº ${numero}</p>
      <p>Emissão: ${dataBR(os.emissao)}</p>
      ${os.previsao ? `<p>Previsão: ${dataBR(os.previsao)}</p>` : ""}
      ${os.saida ? `<p>Saída: ${dataBR(os.saida)}</p>` : ""}
      <p>Status: ${os.status}</p>
      <p>Prioridade: ${os.prioridade}</p>
    </div>
  </div>

  <!-- Cliente / Veículo -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div style="border:1px solid #000;padding:6px">
      <p style="font-weight:bold;text-transform:uppercase">Dados do cliente</p>
      ${c ? `<p>${c.nome}</p><p>CPF/CNPJ: ${formatarDoc(c.cpfCnpj ?? "")}</p><p>Contato: ${formatarTelefone(c.telefone)}</p>${c.endereco ? `<p>${c.endereco}${c.numero ? `, ${c.numero}` : ""}${c.bairro ? ` - ${c.bairro}` : ""}${c.cidade ? ` - ${c.cidade}/${c.uf}` : ""}</p>` : ""}` : ""}
      <p>Resp. técnico: ${EMPRESA.responsavelTecnico}</p>
    </div>
    <div style="border:1px solid #000;padding:6px">
      <p style="font-weight:bold;text-transform:uppercase">Dados do veículo</p>
      ${v ? `<p>${v.marca} ${v.modelo} (${v.ano})</p><p>Placa: ${v.placa}</p>${v.cor ? `<p>Cor: ${v.cor}</p>` : ""}${v.motor ? `<p>Motor: ${v.motor}</p>` : ""}${v.chassi ? `<p>Chassi: ${v.chassi}</p>` : ""}` : ""}
      <p>KM: ${os.km.toLocaleString("pt-BR")} km</p>
    </div>
  </div>

  <!-- Problema relatado -->
  ${os.reclamacao ? `<div style="border:1px solid #000;padding:6px;margin-top:10px"><p style="font-weight:bold;text-transform:uppercase">Problema relatado</p><p>${os.reclamacao}</p></div>` : ""}

  <!-- Tabelas -->
  ${tabela("Serviços executados", servicos)}
  ${tabela("Peças e materiais aplicados", pecas)}

  <!-- Diagnóstico / Observações -->
  ${os.diagnostico || os.observacoes ? `<div style="border:1px solid #000;padding:6px;margin-top:10px">${os.diagnostico ? `<p><strong>Laudo técnico:</strong> ${os.diagnostico}</p>` : ""}${os.observacoes ? `<p><strong>Observações:</strong> ${os.observacoes}</p>` : ""}</div>` : ""}

  <!-- Vistorias -->
  ${vistoria("Vistoria de entrada", os.checklistEntrada)}
  ${vistoria("Vistoria de saída", os.checklistSaida)}

  <!-- Totais -->
  <div style="display:flex;justify-content:flex-end;margin-top:10px">
    <table style="width:auto">
      <tr><td>Total serviços:</td><td style="text-align:right">${brl(t.totalServicos)}</td></tr>
      <tr><td>Total peças:</td><td style="text-align:right">${brl(t.totalPecas)}</td></tr>
      ${t.descontoGeral > 0 ? `<tr><td>Desconto geral:</td><td style="text-align:right">- ${brl(t.descontoGeral)}</td></tr>` : ""}
      <tr><td style="font-weight:bold">Total a pagar:</td><td style="text-align:right;font-weight:bold">${brl(t.total)}</td></tr>
    </table>
  </div>

  <!-- Garantia -->
  <p style="border:1px solid #000;padding:6px;margin-top:10px;font-size:10px"><strong>Garantia:</strong> ${os.garantiaDias} dias. ${EMPRESA.textoGarantia}</p>

  <!-- Assinaturas -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;text-align:center;margin-top:30px;font-size:10px">
    <div style="border-top:1px solid #000;padding-top:4px">${EMPRESA.nome}<br>Empresa</div>
    <div style="border-top:1px solid #000;padding-top:4px">${EMPRESA.responsavelTecnico}<br>Responsável técnico</div>
    <div style="border-top:1px solid #000;padding-top:4px">${c?.nome ?? "Cliente"}<br>Cliente</div>
  </div>

  <!-- Rodapé -->
  <p style="text-align:center;font-size:9px;margin-top:12px">${EMPRESA.nome} — documento gerado em ${new Date().toLocaleString("pt-BR")}</p>

</div>
</body>
</html>`;
  }

  async function abrirImpressao() {
    const html = await construirHtmlImpressao();
    if (!html) { toast.error("Conteúdo não encontrado."); return; }
    const win = window.open("", "_blank");
    if (!win) { toast.error("Popup bloqueado. Permita popups para este site."); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
    const imgs = Array.from(win.document.images);
    const doPrint = () => setTimeout(() => { win.focus(); win.print(); }, 600);
    if (imgs.length === 0) { doPrint(); return; }
    let loaded = 0;
    const tryPrint = () => { if (++loaded >= imgs.length) doPrint(); };
    imgs.forEach((img) => {
      if (img.complete) tryPrint();
      else { img.onload = tryPrint; img.onerror = tryPrint; }
    });
  }

  async function baixarPDF() {
    const html = await construirHtmlImpressao();
    if (!html) { toast.error("Conteúdo não encontrado."); return; }
    const numero = osState?.numero ?? "documento";
    const tid = toast.loading("Gerando PDF…");
    try {
      const resp = await fetch("/api/gerar-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, numero }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${numero}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.dismiss(tid);
      toast.success(`${numero}.pdf baixado.`);
    } catch (err) {
      console.error("baixarPDF:", err);
      toast.dismiss(tid);
      toast.error("Erro ao gerar PDF.");
    }
  }

  if (!osState || !totais) {
    return (
      <AppLayout titulo="Ordem de serviço">
        <Vazio mensagem="Carregando ou registro não encontrado." />
      </AppLayout>
    );
  }

  const os: OrdemServico = osState;

  const atualizar = (campo: keyof OrdemServico, valor: unknown) =>
    setOS((atual) => (atual ? { ...atual, [campo]: valor } : atual));

  const atualizarItem = (itemId: string, campo: keyof ItemOS, valor: unknown) =>
    setOS((atual) =>
      atual
        ? {
            ...atual,
            itens: atual.itens.map((i) => (i.id === itemId ? { ...i, [campo]: valor } : i)),
          }
        : atual,
    );

  function adicionarItem(tipo: "servico" | "peca") {
    const item: ItemOS = {
      id: novoId(),
      tipo,
      descricao: "",
      quantidade: 1,
      valorUnitario: 0,
      custoUnitario: 0,
      desconto: 0,
      origem: tipo === "peca" ? "estoque" : "estoque",
      mecanicoId: "",
      aprovado: true,
      pecaId: "",
    };
    setOS((atual) => (atual ? { ...atual, itens: [...atual.itens, item] } : atual));
  }

  function aplicarValorBase(itemId: string, tipo: "servico" | "peca", chave: string) {
    if (tipo === "servico") {
      const s = servicos.find((x) => x.id === chave);
      if (!s) return;
      setOS((a) =>
        a
          ? {
              ...a,
              itens: a.itens.map((i) =>
                i.id === itemId ? { ...i, descricao: s.nome, valorUnitario: s.valorPadrao } : i,
              ),
            }
          : a,
      );
    } else {
      const p = pecas.find((x) => x.id === chave);
      if (!p) return;
      setOS((a) =>
        a
          ? {
              ...a,
              itens: a.itens.map((i) =>
                i.id === itemId
                  ? {
                      ...i,
                      descricao: p.nome,
                      valorUnitario: p.precoVenda,
                      custoUnitario: p.custo,
                      pecaId: p.id,
                    }
                  : i,
              ),
            }
          : a,
      );
    }
  }

  async function salvar(silencioso = false) {
    const erros: string[] = [];
    for (const i of os.itens) {
      const r = itemSchema.safeParse(i);
      if (!r.success) erros.push(`${i.descricao || "Item sem descrição"}: ${r.error.issues[0]?.message}`);
    }
    const r = ordemServicoSchema.safeParse(os);
    if (!r.success) erros.push(r.error.issues[0]?.message ?? "Dados inválidos");
    if (erros.length) {
      toast.error(erros[0]);
      return false;
    }
    await salvarOS(os, usuario?.uid ?? "sistema");

    //OS já está finalizada, atualiza o lançamento vinculado
    if (os.status === "Finalizado" || os.status === "Entregue/Fechado") {
      const lancamentoVinculado = lancamentos.find((l) => l.osId === os.id);
      if (lancamentoVinculado) {
        const novoValor = totaisOS(os, true).total;
        if (lancamentoVinculado.valor !== novoValor) {
          await salvarLancamento(
            { ...lancamentoVinculado, valor: novoValor },
            usuario?.uid ?? "sistema",
          );
          if (!silencioso) toast.info("Conta a receber atualizada automaticamente.");
        }
      }
    }

    if (!silencioso) toast.success("Alterações salvas.");
    return true;
  }

  async function finalizar() {
    if (!(await salvar(true))) return;
    const atualizada: OrdemServico = {
      ...os,
      status: "Finalizado",
      saida: os.saida || new Date().toISOString().slice(0, 10),
    };
    for (const item of atualizada.itens) {
      if (item.tipo === "peca" && item.origem === "estoque" && item.pecaId) {
        const peca = pecas.find((p) => p.id === item.pecaId);
        if (peca) {
          await salvarPeca(
            { ...peca, quantidade: Math.max(0, peca.quantidade - item.quantidade) },
            usuario?.uid ?? "sistema",
          );
        }
      }
    }
    await salvarOS(atualizada, usuario?.uid ?? "sistema");
    setOS(atualizada);
    const jaTemLancamento = lancamentos.some((l) => l.osId === atualizada.id);
    if (jaTemLancamento) {
      toast.success("OS finalizada. Conta a receber já existente foi mantida.");
    } else {
      setOsParaFinalizar(atualizada);
      setDialogFinalizar(true);
    }
  }

  async function confirmarGerarConta(gerar: boolean) {
    if (!osParaFinalizar) return;
    setDialogFinalizar(false);
    if (gerar) {
      await salvarLancamento(contaReceberDaOS(osParaFinalizar), usuario?.uid ?? "sistema");
      const contasPagar = contasPagarMaoDeObra(osParaFinalizar, usuarios);
      for (const lp of contasPagar) {
        await salvarLancamento(lp, usuario?.uid ?? "sistema");
      }
      const msgPagar =
        contasPagar.length > 0
          ? ` e ${contasPagar.length} conta(s) a pagar de mão de obra`
          : "";
      toast.success(`OS finalizada. Conta a receber${msgPagar} gerada no financeiro.`);
    } else {
      toast.success("OS finalizada sem lançamentos no financeiro.");
    }
    setOsParaFinalizar(null);
  }

  async function converter() {
    const destino = os.tipo === "orcamento" ? "os" : "orcamento";
    const convertida: OrdemServico = {
      ...os,
      tipo: destino,
      numero: proximoNumero(ordens, destino),
      status: destino === "os" ? "Em andamento" : os.status,
      aprovacao: destino === "os" ? "Aprovado" : os.aprovacao,
      itens: destino === "os" ? os.itens.filter((i) => i.aprovado) : os.itens,
    };
    await salvarOS(convertida, usuario?.uid ?? "sistema");
    setOS(convertida);
    toast.success(
      destino === "os"
        ? "Orçamento convertido em OS (apenas itens aprovados)."
        : "OS convertida em orçamento.",
    );
  }

  async function enviarFotos(lado: "checklistEntrada" | "checklistSaida", arquivos: FileList | null) {
    if (!arquivos?.length) return;
    const atual = os[lado] ?? checklistVazio;
    const restantes = MAX_FOTOS - atual.fotos.length;
    if (restantes <= 0) {
      toast.error(`Máximo de ${MAX_FOTOS} fotos por vistoria.`);
      return;
    }
    const novas: string[] = [];
    for (const file of Array.from(arquivos).slice(0, restantes)) {
      const erro = validarArquivoFoto(file);
      if (erro) {
        toast.error(`${file.name}: ${erro}`);
        continue;
      }
      const { blob, tamanhoKb } = await comprimirFoto(file);
      const url = await uploadFoto(blob, os.id, novas.length + atual.fotos.length);
      novas.push(url);
      toast.success(`${file.name} enviada (${tamanhoKb} KB)`);
    }
    atualizar(lado, { ...atual, fotos: [...atual.fotos, ...novas] });
  }

  function atualizarChecklist(
    lado: "checklistEntrada" | "checklistSaida",
    campo: keyof Checklist,
    valor: unknown,
  ) {
    const atual = os[lado] ?? checklistVazio;
    const dataHora = atual.dataHora ?? new Date().toLocaleString("pt-BR");
    atualizar(lado, { ...atual, [campo]: valor, dataHora });
  }

  const BlocoChecklist = ({ lado, titulo }: { lado: "checklistEntrada" | "checklistSaida"; titulo: string }) => {
    const c = os[lado] ?? checklistVazio;
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{titulo}</CardTitle>
              {c.dataHora ? (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Registrada em{" "}
                  <input
                    type="text"
                    className="inline border-b border-dashed border-muted-foreground bg-transparent text-xs text-muted-foreground focus:outline-none focus:border-primary w-40"
                    value={c.dataHora}
                    onChange={(e) => atualizarChecklist(lado, "dataHora", e.target.value)}
                  />
                </p>
              ) : null}
            </div>
            {lado === "checklistSaida" && os.checklistEntrada ? (
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => {
                  const entrada = os.checklistEntrada!;
                  atualizar("checklistSaida", {
                    ...checklistVazio,
                    hodometro: entrada.hodometro,
                    combustivel: entrada.combustivel,
                    itens: { ...entrada.itens },
                    itensInternos: { ...entrada.itensInternos },
                    fotos: [],
                    observacoes: "",
                  });
                }}
              >
                Copiar da entrada
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoTexto
              label="Hodômetro (km)"
              type="number"
              valor={String(c.hodometro)}
              onChange={(v) => atualizarChecklist(lado, "hodometro", Number(v) || 0)}
            />
            <Campo label="Combustível">
              <Select
                value={c.combustivel}
                onValueChange={(v) => atualizarChecklist(lado, "combustivel", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NIVEIS_COMBUSTIVEL.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() => {
                const todosOk = Object.fromEntries(ITENS_VISTORIA.map((i) => [i, "OK"]));
                atualizarChecklist(lado, "itens", { ...c.itens, ...todosOk });
              }}
            >
              <CheckSquare className="mr-1 h-3.5 w-3.5" /> Marcar tudo como OK
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ITENS_VISTORIA.map((item) => {
              const valorAtual = c.itens[item] ?? "";
              return (
                <div key={item} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 text-xs text-muted-foreground">{item}</span>
                  <Select
                    value={OPCOES_VISTORIA.includes(valorAtual as typeof OPCOES_VISTORIA[number]) ? valorAtual : valorAtual ? "__custom__" : ""}
                    onValueChange={(v) => {
                      if (v === "__custom__") return;
                      atualizarChecklist(lado, "itens", { ...c.itens, [item]: v });
                    }}
                  >
                    <SelectTrigger className="h-8 flex-1">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">—</SelectItem>
                      {OPCOES_VISTORIA.map((op) => (
                        <SelectItem key={op} value={op}>{op}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="h-8 w-28 shrink-0"
                    placeholder="Outro..."
                    value={OPCOES_VISTORIA.includes(valorAtual as typeof OPCOES_VISTORIA[number]) ? "" : valorAtual}
                    onChange={(e) =>
                      atualizarChecklist(lado, "itens", { ...c.itens, [item]: e.target.value })
                    }
                  />
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Itens internos do veículo</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ITENS_INTERNOS.map((item) => (
                <label key={item} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={c.itensInternos?.[item] ?? false}
                    onCheckedChange={(v) =>
                      atualizarChecklist(lado, "itensInternos", {
                        ...c.itensInternos,
                        [item]: Boolean(v),
                      })
                    }
                  />
                  {item}
                </label>
              ))}
            </div>
          </div>

          <CampoArea
            label="Observações"
            valor={c.observacoes}
            onChange={(v) => atualizarChecklist(lado, "observacoes", v)}
          />

          <div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <Camera className="h-4 w-4" />
              Adicionar fotos ({c.fotos.length}/{MAX_FOTOS})
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => void enviarFotos(lado, e.target.files)}
              />
            </label>
            <p className="mt-1 text-[11px] text-muted-foreground">
              As fotos são comprimidas automaticamente (WebP, ~120 KB) para manter o custo de
              armazenamento baixo.
            </p>
            {c.fotos.length > 0 ? (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {c.fotos.map((f, idx) => (
                  <div key={f.slice(0, 24) + idx} className="group relative">
                    <img
                      src={f}
                      alt={`Vistoria ${idx + 1}`}
                      className="h-20 w-full rounded-md object-cover"
                    />
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded bg-destructive/90 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() =>
                        atualizarChecklist(
                          lado,
                          "fotos",
                          c.fotos.filter((_, i) => i !== idx),
                        )
                      }
                    >
                      <Trash2 className="h-3 w-3 text-destructive-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout
      titulo={`${os.numero} — ${cliente?.nome ?? "Sem cliente"}`}
      descricao={`${veiculo ? `${veiculo.placa} · ${veiculo.marca} ${veiculo.modelo}` : ""} · Resp. técnico: Jairo Alves de Oliveira`}
      acoes={
        <>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" /> Imprimir
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a
              href={linkWhatsApp(
                cliente?.telefone ?? "",
                os.tipo === "orcamento"
                  ? mensagemOrcamento(os, cliente, veiculo)
                  : mensagemPronto(os, cliente, veiculo),
              )}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="mr-1 h-4 w-4" /> WhatsApp
            </a>
          </Button>
          <Button size="sm" variant="outline" onClick={converter}>
            <ArrowRightLeft className="mr-1 h-4 w-4" />
            {os.tipo === "orcamento" ? "Virar OS" : "Virar orçamento"}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void finalizar()}>
            <CheckCircle2 className="mr-1 h-4 w-4" /> Finalizar
          </Button>
          <Button size="sm" onClick={() => void salvar()}>
            <Save className="mr-1 h-4 w-4" /> Salvar
          </Button>
        </>
      }
    >
      <Tabs defaultValue="dados" className="no-print">
        <TabsList className="flex-wrap">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="itens">Serviços e peças</TabsTrigger>
          <TabsTrigger value="vistoria">Vistoria e fotos</TabsTrigger>
          <TabsTrigger value="documento">Documento</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-4 space-y-4">
          <Card>
            <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <Campo label="Status">
                <Select value={os.status} onValueChange={(v) => atualizar("status", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {osStatus.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
              <Campo label="Aprovação">
                <Select value={os.aprovacao} onValueChange={(v) => atualizar("aprovacao", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Aguardando aprovação", "Aprovado", "Aprovado parcial", "Recusado"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
              <Campo label="Prioridade">
                <Select value={os.prioridade} onValueChange={(v) => atualizar("prioridade", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Baixa", "Média", "Alta"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
              <CampoTexto
                label="Emissão"
                type="date"
                valor={os.emissao}
                onChange={(v) => atualizar("emissao", v)}
              />
              <CampoTexto
                label="Previsão"
                type="date"
                valor={os.previsao ?? ""}
                onChange={(v) => atualizar("previsao", v)}
              />
              <CampoTexto
                label="Saída"
                type="date"
                valor={os.saida ?? ""}
                onChange={(v) => atualizar("saida", v)}
              />
              <CampoTexto
                label="Quilometragem"
                type="number"
                valor={String(os.km)}
                onChange={(v) => atualizar("km", Number(v) || 0)}
              />
              <CampoTexto
                label="Cor do veículo"
                valor={String((os as Record<string, unknown>)["corVeiculo"] ?? veiculo?.cor ?? "")}
                onChange={(v) => atualizar("corVeiculo" as keyof OrdemServico, v)}
              />
              <CampoTexto
                label="Garantia (dias)"
                type="number"
                valor={String(os.garantiaDias)}
                onChange={(v) => atualizar("garantiaDias", Number(v) || 0)}
              />
              <Campo label="Mecânico responsável">
                <Select
                  value={os.mecanicoId || "nenhum"}
                  onValueChange={(v) => atualizar("mecanicoId", v === "nenhum" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Não definido</SelectItem>
                    {mecanicos.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
              <CampoArea
                label="Reclamação / solicitação do cliente"
                className="sm:col-span-2 lg:col-span-3"
                valor={os.reclamacao}
                onChange={(v) => atualizar("reclamacao", v)}
              />
              <CampoArea
                label="Diagnóstico / laudo técnico"
                className="sm:col-span-2 lg:col-span-3"
                valor={os.diagnostico}
                onChange={(v) => atualizar("diagnostico", v)}
              />
              <CampoArea
                label="Observações"
                className="sm:col-span-2 lg:col-span-3"
                valor={os.observacoes}
                onChange={(v) => atualizar("observacoes", v)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="itens" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => adicionarItem("servico")}>
              <Plus className="mr-1 h-4 w-4" /> Serviço / mão de obra
            </Button>
            <Button size="sm" variant="outline" onClick={() => adicionarItem("peca")}>
              <Plus className="mr-1 h-4 w-4" /> Peça / produto
            </Button>
          </div>

          {os.itens.length === 0 ? (
            <Vazio mensagem="Nenhum item adicionado." />
          ) : (
            os.itens.map((i) => (
              <Card key={i.id}>
                <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-2">
                    <Badge variant={i.tipo === "peca" ? "secondary" : "outline"}>
                      {i.tipo === "peca" ? "Peça" : "Mão de obra"}
                    </Badge>
                    <Select
                      value=""
                      onValueChange={(v) => aplicarValorBase(i.id, i.tipo, v)}
                    >
                      <SelectTrigger className="h-8 w-64">
                        <SelectValue placeholder="Usar valor cadastrado..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(i.tipo === "servico" ? servicos : pecas).map((x) => (
                          <SelectItem key={x.id} value={x.id}>
                            {x.nome} —{" "}
                            {brl("valorPadrao" in x ? x.valorPadrao : (x as Peca).precoVenda)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={i.aprovado}
                        onCheckedChange={(v) => atualizarItem(i.id, "aprovado", Boolean(v))}
                      />
                      Aprovado pelo cliente
                    </label>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto text-destructive"
                      onClick={() =>
                        setOS((a) => (a ? { ...a, itens: a.itens.filter((x) => x.id !== i.id) } : a))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

<CampoTexto
  label="Descrição"
  className="sm:col-span-2"
  valor={i.descricao}
  onChange={(v) => atualizarItem(i.id, "descricao", v)}
  onBlur={() => {
    if (i.tipo !== "peca") return;
    if (!i.descricao.trim()) return;
    if (i.pecaId) return; 
    const existe = pecas.some(
      (p) => p.nome.toLowerCase() === i.descricao.toLowerCase(),
    );
    if (!existe) {
      setModalPeca({ itemId: i.id, nome: i.descricao, custo: "", venda: "" });
    }
  }}
/>
                  <CampoTexto
                    label="Qtd"
                    type="number"
                    valor={String(i.quantidade)}
                    onChange={(v) => atualizarItem(i.id, "quantidade", Number(v) || 0)}
                  />
                  <CampoTexto
                    label="Valor unitário"
                    type="number"
                    valor={String(i.valorUnitario)}
                    onChange={(v) => atualizarItem(i.id, "valorUnitario", Number(v) || 0)}
                  />
                  <CampoTexto
                    label="Desconto"
                    type="number"
                    valor={String(i.desconto)}
                    onChange={(v) => atualizarItem(i.id, "desconto", Number(v) || 0)}
                  />
                  {i.tipo === "peca" ? (
                    <>
                      {pode("ver-margem") ? (
                        <CampoTexto
                          label="Custo (interno)"
                          type="number"
                          valor={String(i.custoUnitario)}
                          onChange={(v) => atualizarItem(i.id, "custoUnitario", Number(v) || 0)}
                        />
                      ) : null}
                      <Campo label="Origem (uso interno)">
                        <Select
                          value={i.origem}
                          onValueChange={(v) => atualizarItem(i.id, "origem", v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="estoque">Estoque da oficina</SelectItem>
                            <SelectItem value="autopecas">Comprada das autopeças</SelectItem>
                            <SelectItem value="cliente">Fornecida pelo cliente</SelectItem>
                          </SelectContent>
                        </Select>
                      </Campo>
                    </>
                  ) : (
                    <Campo label="Mecânico do serviço">
                      <Select
                        value={i.mecanicoId || "nenhum"}
                        onValueChange={(v) =>
                          atualizarItem(i.id, "mecanicoId", v === "nenhum" ? "" : v)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nenhum">Não definido</SelectItem>
                          {mecanicos.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Campo>
                  )}
                  <div className="flex items-end justify-end sm:col-span-2 lg:col-span-4">
                    <span className="text-sm">
                      Total do item: <strong className="text-primary">{brl(itemTotal(i))}</strong>
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}

          <Card>
            <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <CampoTexto
                label="Desconto geral"
                type="number"
                valor={String(os.descontoGeral)}
                onChange={(v) => atualizar("descontoGeral", Number(v) || 0)}
              />
              <div className="sm:col-span-2 lg:col-span-3 grid gap-1 text-sm">
                <p className="flex justify-between">
                  <span>Total de mão de obra</span>
                  <strong>{brl(totais.totalServicos)}</strong>
                </p>
                <p className="flex justify-between">
                  <span>Total de peças/produtos</span>
                  <strong>{brl(totais.totalPecas)}</strong>
                </p>
                <p className="flex justify-between">
                  <span>Descontos nos itens</span>
                  <strong>- {brl(totais.descontoItens)}</strong>
                </p>
                <p className="flex justify-between">
                  <span>Desconto geral</span>
                  <strong>- {brl(totais.descontoGeral)}</strong>
                </p>
                <p className="flex justify-between border-t border-border pt-2 text-base">
                  <span>Total geral</span>
                  <strong className="text-primary">{brl(totais.total)}</strong>
                </p>
                {pode("ver-margem") ? (
                  <p className="mt-2 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                    Uso interno — custo das peças {brl(totais.custoPecas)} · margem em peças{" "}
                    {brl(totais.margemPecas)} · mão de obra {brl(totais.margemServicos)} · resultado
                    estimado <strong className="text-success">{brl(totais.margemTotal)}</strong>
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vistoria" className="mt-4 space-y-4">
          <BlocoChecklist lado="checklistEntrada" titulo="Vistoria de entrada" />
          <BlocoChecklist lado="checklistSaida" titulo="Vistoria de saída (entrega)" />
        </TabsContent>

        <TabsContent value="documento" className="mt-4">
          <div id="impressao-os" className="overflow-x-auto rounded-lg border border-border">
            <ImpressaoOS os={os} cliente={cliente} veiculo={veiculo} mecanicos={usuarios} />
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" onClick={() => void abrirImpressao()}>
              <Printer className="mr-1 h-4 w-4" /> Imprimir
            </Button>
            <Button variant="outline" onClick={() => void baixarPDF()}>
              <Download className="mr-1 h-4 w-4" /> Baixar PDF
            </Button>
            <Button variant="ghost" onClick={() => navigate({ to: "/os" })}>
              Voltar para a lista
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <div className="hidden print:block">
        <ImpressaoOS os={os} cliente={cliente} veiculo={veiculo} mecanicos={usuarios} />
      </div>

      <Dialog open={dialogFinalizar} onOpenChange={(v) => { if (!v) setDialogFinalizar(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Gerar conta a receber?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta OS vale{" "}
            <strong className="text-foreground">
              {osParaFinalizar ? brl(totaisOS(osParaFinalizar, true).total) : ""}
            </strong>{" "}
            e ainda não tem conta a receber criada. Deseja lançar a cobrança no financeiro?
          </p>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => void confirmarGerarConta(false)}>
              Salvar mesmo assim
            </Button>
            <Button className="bg-success text-success-foreground hover:bg-success/90" onClick={() => void confirmarGerarConta(true)}>
              Salvar e gerar conta a receber
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {modalPeca ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-xl space-y-4">
            <p className="font-semibold text-base">Peça não encontrada no estoque</p>
            <p className="text-sm text-muted-foreground">
              Cadastre agora e ela será criada automaticamente.
            </p>
            <CampoTexto
              label="Nome da peça"
              valor={modalPeca.nome}
              onChange={(v) => setModalPeca((m) => m ? { ...m, nome: v } : m)}
            />
            <CampoTexto
              label="Valor de custo (R$)"
              type="number"
              valor={modalPeca.custo}
              onChange={(v) => setModalPeca((m) => m ? { ...m, custo: v } : m)}
              onBlur={() =>
                setModalPeca((m) => {
                  if (!m) return m;
                  if (m.venda) return m;
                  const custo = Number(m.custo) || 0;
                  if (!custo) return m;
                  return { ...m, venda: (custo * 1.6).toFixed(2) };
                })
              }
            />
            <CampoTexto
              label="Valor de venda (R$)"
              type="number"
              valor={modalPeca.venda}
              onChange={(v) => setModalPeca((m) => m ? { ...m, venda: v } : m)}
            />
            {(() => {
              const custo = Number(modalPeca.custo) || 0;
              const venda = Number(modalPeca.venda) || 0;
              const lucro = venda - custo;
              const margem = custo > 0 ? (lucro / custo) * 100 : 0;
              const qualidade =
                margem >= 60
                  ? { label: "▲ Boa", cor: "text-success" }
                  : margem >= 30
                  ? { label: "▶ Razoável", cor: "text-warning" }
                  : { label: "▼ Baixa", cor: "text-destructive" };
              return (
                <>
                  {custo > 0 ? (
                    <div className="flex gap-2">
                      {[40, 60, 80].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          className="flex-1 rounded-md border border-border bg-muted py-1 text-xs hover:border-primary"
                          onClick={() =>
                            setModalPeca((m) =>
                              m
                                ? { ...m, venda: (custo * (1 + pct / 100)).toFixed(2) }
                                : m,
                            )
                          }
                        >
                          +{pct}%
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {(venda > 0 || custo > 0) ? (
                    <div className="rounded-md bg-muted px-3 py-2 text-sm space-y-0.5">
                      <p className="text-muted-foreground">
                        Lucro bruto: <strong>{brl(lucro)}</strong>
                      </p>
                      <p className={qualidade.cor}>
                        Margem: <strong>{margem.toFixed(0)}%</strong> {qualidade.label}
                      </p>
                    </div>
                  ) : null}
                </>
              );
            })()}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setModalPeca(null)}>
                Ignorar
              </Button>
              <Button onClick={() => void criarPecaNoEstoque()}>
                Criar no estoque
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppLayout>
  );
}
