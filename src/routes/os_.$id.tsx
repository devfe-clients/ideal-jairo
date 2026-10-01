import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Camera,
  CheckCircle2,
  CheckSquare,
  Download,
  FileText,
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
import { ITENS_VISTORIA, NIVEIS_COMBUSTIVEL, OPCOES_VISTORIA, OPCOES_POR_ITEM, ITENS_INTERNOS } from "@/lib/empresa";
import { MAX_FOTOS, uploadFoto, comprimirFoto, validarArquivoFoto } from "@/lib/fotos";
import { useAuth } from "@/lib/auth";

function ItemVistoria({
  label,
  valorAtual,
  ehOpcaoPadrao,
  onSelectChange,
  onOutroBlur,
}: {
  label: string;
  valorAtual: string;
  ehOpcaoPadrao: boolean;
  onSelectChange: (v: string) => void;
  onOutroBlur: (v: string) => void;
}) {
  const [outroLocal, setOutroLocal] = useState(ehOpcaoPadrao ? "" : valorAtual);
  useEffect(() => {
    setOutroLocal(ehOpcaoPadrao ? "" : valorAtual);
  }, [valorAtual, ehOpcaoPadrao]);

  const opcoes = OPCOES_POR_ITEM[label] ?? OPCOES_VISTORIA;

  return (
    <div className="rounded-md border border-border p-2 space-y-1.5">
      <span className="block text-xs font-medium text-foreground">{label}</span>
      <div className="flex gap-2">
        <Select
          value={ehOpcaoPadrao ? valorAtual : valorAtual ? "__custom__" : ""}
          onValueChange={(v) => {
            if (v === "__custom__") return;
            setOutroLocal("");
            onSelectChange(v);
          }}
        >
          <SelectTrigger className="h-8 flex-1">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">—</SelectItem>
            {opcoes.map((op) => (
              <SelectItem key={op} value={op}>{op}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="h-8 w-28 shrink-0"
          placeholder="Outro..."
          value={outroLocal}
          onChange={(e) => setOutroLocal(e.target.value)}
          onBlur={() => { if (outroLocal !== valorAtual) onOutroBlur(outroLocal); }}
        />
      </div>
    </div>
  );
}

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
  const { dados: pecas, salvar: salvarPeca, carregando: carregandoPecas } = useColecao<Peca>("pecas");
  const { dados: servicos, salvar: salvarServico } = useColecao<ServicoBase>("servicos");
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
  margem: string;
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

  const [modalNovoServico, setModalNovoServico] = useState<{
    itemId: string;
    nome: string;
    valor: string;
    custo: string;
    desconto: string;
  } | null>(null);

  async function criarNovoServico() {
    if (!modalNovoServico) return;
    const novo: ServicoBase = {
      id: novoId(),
      nome: modalNovoServico.nome,
      valorPadrao: Number(modalNovoServico.valor) || 0,
      tempoEstimado: 1,
      disponivelParaAgendamento: true,
    };
    await salvarServico(novo, usuario?.uid ?? "sistema");
    setOS((a) =>
      a
        ? {
            ...a,
            itens: a.itens.map((i) =>
              i.id === modalNovoServico.itemId
                ? { ...i, descricao: novo.nome, valorUnitario: novo.valorPadrao ?? 0 }
                : i,
            ),
          }
        : a,
    );
    toast.success(`Serviço "${novo.nome}" criado e aplicado.`);
    setModalNovoServico(null);
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
        <td style="text-align:center">${Number(i.quantidade ?? 0).toFixed(2)}</td>
        <td style="text-align:right">${Number(i.valorUnitario ?? 0).toFixed(2)}</td>
        <td style="text-align:right">${Number(i.desconto ?? 0).toFixed(2)}</td>
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

  async function construirHtmlVistoria(): Promise<string> {
    if (!osState) return "";
    const os = osState;
    const c = clientes.find((x) => x.id === os.clienteId);
    const v = veiculos.find((x) => x.id === os.veiculoId);
    const { EMPRESA } = await import("@/lib/empresa");

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

    const blocoVistoria = (titulo: string, cv?: typeof os.checklistEntrada) => {
      if (!cv) return "";
      const marcados = Object.entries(cv.itens).filter(([, val]) => val);
      return `
      <div style="margin-top:12px;border:1px solid #000;padding:8px;font-size:11px">
        <p style="font-weight:bold;text-transform:uppercase">${titulo}${cv.dataHora ? ` <span style="font-weight:normal;font-size:10px;text-transform:none">— registrada em ${cv.dataHora}</span>` : ""}</p>
        <p style="margin-top:4px">Hodômetro: ${cv.hodometro.toLocaleString("pt-BR")} km · Combustível: ${cv.combustivel}</p>
        ${marcados.length > 0 ? `<ul style="margin-top:4px;columns:2;list-style:none;padding:0">${marcados.map(([k, val]) => `<li><strong>${k}:</strong> ${val}</li>`).join("")}</ul>` : ""}
        ${cv.observacoes ? `<p style="margin-top:4px">Obs.: ${cv.observacoes}</p>` : ""}
        ${cv.fotos.length > 0 ? `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:8px">${cv.fotos.map((f, i) => `<img src="${f}" alt="foto ${i + 1}" style="width:100%;height:80px;object-fit:cover;border-radius:4px">`).join("")}</div>` : ""}
      </div>`;
    };

    const temVistoria = os.checklistEntrada || os.checklistSaida;
    if (!temVistoria) return "";

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Vistoria — ${os.numero}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#000;background:#fff;padding:16px;}
  @page{size:A4;margin:10mm;}
  @media print{body{padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
</style>
</head>
<body>
<div style="max-width:820px;margin:0 auto">

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
      <p style="font-size:14px;font-weight:bold;text-transform:uppercase">Vistoria do Veículo</p>
      <p style="font-weight:bold">OS Nº ${os.numero}</p>
      ${v ? `<p>${v.marca} ${v.modelo} — ${v.placa}</p>` : ""}
      ${c ? `<p>Cliente: ${c.nome}</p>` : ""}
    </div>
  </div>

  ${blocoVistoria("Vistoria de entrada", os.checklistEntrada)}
  ${blocoVistoria("Vistoria de saída (entrega)", os.checklistSaida)}

  <p style="text-align:center;font-size:9px;margin-top:16px">${EMPRESA.nome} — documento gerado em ${new Date().toLocaleString("pt-BR")}</p>
</div>
</body>
</html>`;
  }

  async function baixarPDFVistoria() {
    const html = await construirHtmlVistoria();
    if (!html) { toast.error("Nenhuma vistoria registrada nesta OS."); return; }
    const numero = osState?.numero ?? "documento";
    const tid = toast.loading("Gerando PDF da vistoria…");
    try {
      const resp = await fetch("/api/gerar-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, numero: `${numero}-vistoria` }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${numero}-vistoria.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.dismiss(tid);
      toast.success(`${numero}-vistoria.pdf baixado.`);
    } catch (err) {
      console.error("baixarPDFVistoria:", err);
      toast.dismiss(tid);
      toast.error("Erro ao gerar PDF da vistoria.");
    }
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
                i.id === itemId ? { ...i, descricao: s.nome, valorUnitario: s.valorPadrao ?? 0 } : i,
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
    const [hodometroLocal, setHodometroLocal] = useState(String(c.hodometro));
    useEffect(() => { setHodometroLocal(String(c.hodometro)); }, [c.hodometro]);

    const parsearDataHora = (dh: string) => {
      const [datePart, timePart] = dh.split(" ");
      const [dia, mes, ano] = (datePart ?? "").split("/");
      const dataInput = ano && mes && dia ? `${ano}-${mes}-${dia}` : "";
      const horaInput = timePart ? timePart.slice(0, 5) : "";
      return { dataInput, horaInput };
    };
    const { dataInput, horaInput } = c.dataHora ? parsearDataHora(c.dataHora) : { dataInput: "", horaInput: "" };

    function salvarDataHora(novaData: string, novaHora: string) {
      if (!novaData && !novaHora) return;
      const [ano, mes, dia] = novaData.split("-");
      const dataFormatada = dia && mes && ano ? `${dia}/${mes}/${ano}` : "";
      const horaFormatada = novaHora || "00:00";
      atualizarChecklist(lado, "dataHora", `${dataFormatada} ${horaFormatada}`);
    }
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{titulo}</CardTitle>
              {c.dataHora !== undefined ? (
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-muted-foreground">Registrada em</span>
                  <input
                    type="date"
                    className="h-6 rounded border border-border bg-muted px-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                    value={dataInput}
                    onChange={(e) => salvarDataHora(e.target.value, horaInput)}
                  />
                  <input
                    type="time"
                    className="h-6 rounded border border-border bg-muted px-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                    value={horaInput}
                    onChange={(e) => salvarDataHora(dataInput, e.target.value)}
                  />
                </div>
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
              valor={hodometroLocal}
              onChange={(v) => setHodometroLocal(v)}
              onBlur={() => atualizarChecklist(lado, "hodometro", Number(hodometroLocal) || 0)}
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
              const opcoesDeste = OPCOES_POR_ITEM[item] ?? OPCOES_VISTORIA;
              const ehOpcaoPadrao = (opcoesDeste as readonly string[]).includes(valorAtual);
              return (
                <ItemVistoria
                  key={`${lado}-${item}`}
                  label={item}
                  valorAtual={valorAtual}
                  ehOpcaoPadrao={ehOpcaoPadrao}
                  onSelectChange={(v) => atualizarChecklist(lado, "itens", { ...c.itens, [item]: v })}
                  onOutroBlur={(v) => atualizarChecklist(lado, "itens", { ...c.itens, [item]: v })}
                />
              );
            })}
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
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-md bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                      <a
                        href={f}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-16 rounded bg-white px-1.5 py-0.5 text-center text-[9px] font-medium text-black hover:bg-gray-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Abrir
                      </a>
                      <a
                        href={f}
                        download={`vistoria-${idx + 1}.webp`}
                        className="w-16 rounded bg-white px-1.5 py-0.5 text-center text-[9px] font-medium text-black hover:bg-gray-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Baixar
                      </a>
                      <button
                        type="button"
                        className="mt-0.5 rounded bg-destructive/90 p-1"
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => void baixarPDFVistoria()}
            disabled={!os.checklistEntrada && !os.checklistSaida}
          >
            <FileText className="mr-1 h-4 w-4" /> Vistoria PDF
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
          <TabsTrigger value="servicos">Serviços e Produtos</TabsTrigger>
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

        {/* ── ABA: SERVIÇOS E PRODUTOS ──────────────────────────────── */}
        <TabsContent value="servicos" className="mt-4 space-y-4">

          {/* Bloco Serviços */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base">Serviços</CardTitle>
                  <p className="text-xs text-muted-foreground">Adicione os serviços prestados nesta ordem</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => void navigate({ to: "/configuracoes" })}>
                  Cadastro de Serviços
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Serviço</th>
                      <th className="w-24 px-4 py-2 text-center font-medium text-muted-foreground">QTD</th>
                      <th className="w-32 px-4 py-2 text-right font-medium text-muted-foreground">Preço Unit.</th>
                      <th className="w-28 px-4 py-2 text-right font-medium text-muted-foreground">Desconto</th>
                      <th className="w-32 px-4 py-2 text-right font-medium text-muted-foreground">Total</th>
                      <th className="w-10 px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {os.itens.filter((i) => i.tipo === "servico").length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                          Nenhum serviço adicionado.
                        </td>
                      </tr>
                    ) : (
                      os.itens
                        .filter((i) => i.tipo === "servico")
                        .map((i) => (
                          <tr key={i.id} className="border-b border-border last:border-0">
                            <td className="px-4 py-2">
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Select
                                    value=""
                                    onValueChange={(v) => aplicarValorBase(i.id, "servico", v)}
                                  >
                                    <SelectTrigger className="h-7 w-48 text-xs">
                                      <SelectValue placeholder="Selecione o serviço" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {servicos.length === 0 ? (
                                        <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum serviço cadastrado.</div>
                                      ) : (
                                        servicos.map((x) => (
                                          <SelectItem key={x.id} value={x.id}>
                                            {x.nome}{x.valorPadrao ? ` — ${brl(x.valorPadrao)}` : ""}
                                          </SelectItem>
                                        ))
                                      )}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    title="Criar novo serviço"
                                    onClick={() =>
                                      setModalNovoServico({ itemId: i.id, nome: i.descricao, valor: "", custo: "", desconto: "" })
                                    }
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                                <div className="flex items-center gap-3 flex-wrap">
                                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Checkbox
                                      checked={i.aprovado}
                                      onCheckedChange={(v) => atualizarItem(i.id, "aprovado", Boolean(v))}
                                    />
                                    Aprovado pelo cliente
                                  </label>
                                  <Select
                                    value={i.mecanicoId || "nenhum"}
                                    onValueChange={(v) => atualizarItem(i.id, "mecanicoId", v === "nenhum" ? "" : v)}
                                  >
                                    <SelectTrigger className="h-7 w-40 text-xs">
                                      <SelectValue placeholder="Mecânico" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="nenhum">Sem mecânico</SelectItem>
                                      {mecanicos.map((m) => (
                                        <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                type="number"
                                className="h-8 w-20 text-center"
                                value={i.quantidade === 0 ? "" : i.quantidade}
                                placeholder="0"
                                onChange={(e) => atualizarItem(i.id, "quantidade", Number(e.target.value) || 0)}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                type="number"
                                className="h-8 w-28 text-right"
                                value={i.valorUnitario === 0 ? "" : i.valorUnitario}
                                placeholder="0,00"
                                onChange={(e) => atualizarItem(i.id, "valorUnitario", Number(e.target.value) || 0)}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                type="number"
                                className="h-8 w-24 text-right"
                                value={i.desconto === 0 ? "" : i.desconto}
                                placeholder="0,00"
                                onChange={(e) => atualizarItem(i.id, "desconto", Number(e.target.value) || 0)}
                              />
                            </td>
                            <td className="px-4 py-2 text-right font-medium">
                              {brl(itemTotal(i))}
                            </td>
                            <td className="px-2 py-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-destructive"
                                onClick={() =>
                                  setOS((a) => (a ? { ...a, itens: a.itens.filter((x) => x.id !== i.id) } : a))
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="p-3 border-t border-border">
                <Button size="sm" variant="outline" onClick={() => adicionarItem("servico")}>
                  <Plus className="mr-1 h-4 w-4" /> Adicionar Serviço
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Bloco Peças e Produtos */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base">Produtos/Peças</CardTitle>
                  <p className="text-xs text-muted-foreground">Adicione os produtos e peças utilizados nesta ordem</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => void navigate({ to: "/estoque" })}>
                  Cadastro de Produtos
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Produto</th>
                      <th className="w-24 px-4 py-2 text-center font-medium text-muted-foreground">QTD</th>
                      <th className="w-32 px-4 py-2 text-right font-medium text-muted-foreground">Preço Unit.</th>
                      <th className="w-28 px-4 py-2 text-right font-medium text-muted-foreground">Desconto</th>
                      <th className="w-32 px-4 py-2 text-right font-medium text-muted-foreground">Total</th>
                      <th className="w-10 px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {os.itens.filter((i) => i.tipo === "peca").length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                          Nenhuma peça ou produto adicionado.
                        </td>
                      </tr>
                    ) : (
                      os.itens
                        .filter((i) => i.tipo === "peca")
                        .map((i) => (
                          <tr key={i.id} className="border-b border-border last:border-0">
                            <td className="px-4 py-2">
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Select
                                    value={i.pecaId || ""}
                                    onValueChange={(v) => { if (v) aplicarValorBase(i.id, "peca", v); }}
                                  >
                                    <SelectTrigger className="h-7 w-48 text-xs">
                                      <SelectValue placeholder="Usar peça do estoque..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="">digitação livre</SelectItem>
                                      {carregandoPecas ? (
                                        <div className="px-3 py-2 text-xs text-muted-foreground">Carregando estoque…</div>
                                      ) : pecas.length === 0 ? (
                                        <div className="px-3 py-2 text-xs text-muted-foreground">Nenhuma peça no estoque.</div>
                                      ) : (
                                        pecas
                                          .slice()
                                          .sort((a, b) => a.nome.localeCompare(b.nome))
                                          .map((x) => (
                                            <SelectItem key={x.id} value={x.id}>
                                              {x.nome}{x.codigo ? ` (${x.codigo})` : ""} — {x.quantidade} un · {brl(x.precoVenda)}
                                            </SelectItem>
                                          ))
                                      )}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    title="Criar nova peça no estoque"
                                    onClick={() =>
                                      setModalPeca({ itemId: i.id, nome: i.descricao, custo: "", venda: "", margem: "" })
                                    }
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                                <div className="flex items-center gap-3 flex-wrap">
                                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Checkbox
                                      checked={i.aprovado}
                                      onCheckedChange={(v) => atualizarItem(i.id, "aprovado", Boolean(v))}
                                    />
                                    Aprovado pelo cliente
                                  </label>
                                  <Select
                                    value={i.origem}
                                    onValueChange={(v) => atualizarItem(i.id, "origem", v)}
                                  >
                                    <SelectTrigger className="h-7 w-44 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="estoque">Estoque da oficina</SelectItem>
                                      <SelectItem value="autopecas">Comprada das autopeças</SelectItem>
                                      <SelectItem value="cliente">Fornecida pelo cliente</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {pode("ver-margem") ? (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <span>Custo:</span>
                                      <Input
                                        type="number"
                                        className="h-6 w-20 text-xs"
                                        value={i.custoUnitario === 0 ? "" : i.custoUnitario}
                                        placeholder="0,00"
                                        onChange={(e) => atualizarItem(i.id, "custoUnitario", Number(e.target.value) || 0)}
                                      />
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                type="number"
                                className="h-8 w-20 text-center"
                                value={i.quantidade === 0 ? "" : i.quantidade}
                                placeholder="0"
                                onChange={(e) => atualizarItem(i.id, "quantidade", Number(e.target.value) || 0)}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                type="number"
                                className="h-8 w-28 text-right"
                                value={i.valorUnitario === 0 ? "" : i.valorUnitario}
                                placeholder="0,00"
                                onChange={(e) => atualizarItem(i.id, "valorUnitario", Number(e.target.value) || 0)}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                type="number"
                                className="h-8 w-24 text-right"
                                value={i.desconto === 0 ? "" : i.desconto}
                                placeholder="0,00"
                                onChange={(e) => atualizarItem(i.id, "desconto", Number(e.target.value) || 0)}
                              />
                            </td>
                            <td className="px-4 py-2 text-right font-medium">
                              {brl(itemTotal(i))}
                            </td>
                            <td className="px-2 py-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-destructive"
                                onClick={() =>
                                  setOS((a) => (a ? { ...a, itens: a.itens.filter((x) => x.id !== i.id) } : a))
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="p-3 border-t border-border">
                <Button size="sm" variant="outline" onClick={() => adicionarItem("peca")}>
                  <Plus className="mr-1 h-4 w-4" /> Adicionar Produto
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Resumo financeiro */}
          <Card>
            <CardContent className="p-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border border-border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Valor de Serviços</p>
                  <p className="text-lg font-semibold text-foreground">{brl(totais.totalServicos)}</p>
                </div>
                <div className="rounded-md border border-border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Valor de Produtos</p>
                  <p className="text-lg font-semibold text-foreground">{brl(totais.totalPecas)}</p>
                </div>
                <div className="rounded-md border border-border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Descontos</p>
                  <p className="text-lg font-semibold text-destructive">- {brl(totais.descontoItens)}</p>
                </div>
                <div className="rounded-md border border-border p-3 text-center bg-primary/5">
                  <p className="text-xs text-muted-foreground">Valor Total</p>
                  <p className="text-lg font-semibold text-primary">{brl(totais.total)}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Desconto geral:</span>
                <Input
                  type="number"
                  className="h-8 w-32"
                  value={os.descontoGeral === 0 ? "" : os.descontoGeral}
                  placeholder="0,00"
                  onChange={(e) => atualizar("descontoGeral", Number(e.target.value) || 0)}
                />
              </div>
              {pode("ver-margem") ? (
                <p className="mt-2 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                  Uso interno — custo das peças {brl(totais.custoPecas)} · margem em peças{" "}
                  {brl(totais.margemPecas)} · mão de obra {brl(totais.margemServicos)} · resultado
                  estimado <strong className="text-success">{brl(totais.margemTotal)}</strong>
                </p>
              ) : null}
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar OS</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Esta OS vale{" "}
              <strong className="text-foreground text-base">
                {osParaFinalizar ? brl(totaisOS(osParaFinalizar, true).total) : ""}
              </strong>
              {" "}e ainda não tem conta a receber criada.
            </p>
            <p className="text-sm text-muted-foreground">
              Deseja lançar a cobrança no financeiro?
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              className="w-full bg-success text-success-foreground hover:bg-success/90"
              onClick={() => void confirmarGerarConta(true)}
            >
              Salvar e gerar conta a receber
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => void confirmarGerarConta(false)}
            >
              Salvar sem lançar no financeiro
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {modalNovoServico ? (
        <Dialog open onOpenChange={(v) => { if (!v) setModalNovoServico(null); }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Criar</DialogTitle>
            </DialogHeader>
            <div className="space-y-1 pb-1">
              <p className="text-sm font-medium">Informações do Serviço</p>
              <p className="text-xs text-muted-foreground">Preencha os dados para criar um novo serviço</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <CampoTexto
                  label="Nome *"
                  valor={modalNovoServico.nome}
                  onChange={(v) => setModalNovoServico((m) => m ? { ...m, nome: v } : m)}
                />
              </div>
              <CampoTexto
                label="Preço de Venda *"
                type="number"
                valor={modalNovoServico.valor}
                onChange={(v) => setModalNovoServico((m) => m ? { ...m, valor: v } : m)}
              />
              <CampoTexto
                label="Custo Estimado"
                type="number"
                valor={modalNovoServico.custo}
                onChange={(v) => setModalNovoServico((m) => m ? { ...m, custo: v } : m)}
              />
              <CampoTexto
                label="Desconto"
                type="number"
                valor={modalNovoServico.desconto}
                onChange={(v) => setModalNovoServico((m) => m ? { ...m, desconto: v } : m)}
              />
            </div>
            {(() => {
              const venda = Number(modalNovoServico.valor) || 0;
              const desconto = Number(modalNovoServico.desconto) || 0;
              const total = venda - desconto;
              if (total <= 0) return null;
              return (
                <div className="rounded-md bg-muted px-3 py-2 text-sm flex justify-between">
                  <span className="text-muted-foreground">Valor total do item</span>
                  <strong className="text-primary">{brl(total)}</strong>
                </div>
              );
            })()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setModalNovoServico(null)}>Cancelar</Button>
              <Button onClick={() => void criarNovoServico()}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {modalPeca ? (
        <Dialog open onOpenChange={(v) => { if (!v) setModalPeca(null); }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Criar</DialogTitle>
            </DialogHeader>
            <div className="space-y-1 pb-1">
              <p className="text-sm font-medium">Informações do Produto</p>
              <p className="text-xs text-muted-foreground">Preencha os dados para criar um novo produto</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <CampoTexto
                  label="Nome do Produto *"
                  valor={modalPeca.nome}
                  onChange={(v) => setModalPeca((m) => m ? { ...m, nome: v } : m)}
                />
              </div>
              <CampoTexto
                label="Valor de Custo"
                type="number"
                valor={modalPeca.custo}
                onChange={(v) => {
                  setModalPeca((m) => {
                    if (!m) return m;
                    const custo = Number(v) || 0;
                    const margem = Number(m.margem) || 0;
                    const venda = margem > 0 ? (custo * (1 + margem / 100)).toFixed(2) : m.venda;
                    return { ...m, custo: v, venda };
                  });
                }}
              />
              <CampoTexto
                label="Margem"
                type="number"
                valor={modalPeca.margem ?? ""}
                onChange={(v) => {
                  setModalPeca((m) => {
                    if (!m) return m;
                    const custo = Number(m.custo) || 0;
                    const margem = Number(v) || 0;
                    const venda = custo > 0 ? (custo * (1 + margem / 100)).toFixed(2) : m.venda;
                    return { ...m, margem: v, venda };
                  });
                }}
              />
              <div className="sm:col-span-2">
                <CampoTexto
                  label="Valor de Venda *"
                  type="number"
                  valor={modalPeca.venda}
                  onChange={(v) => {
                    setModalPeca((m) => {
                      if (!m) return m;
                      const custo = Number(m.custo) || 0;
                      const venda = Number(v) || 0;
                      const margem = custo > 0 ? ((venda - custo) / custo * 100).toFixed(0) : m.margem;
                      return { ...m, venda: v, margem };
                    });
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModalPeca(null)}>Cancelar</Button>
              <Button onClick={() => void criarPecaNoEstoque()}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </AppLayout>
  );
}
