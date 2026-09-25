import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Campo, CampoTexto, Vazio, useFormularioZod } from "@/components/form-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { useColecao, novoId } from "@/lib/db";
import { lancamentoSchema, type Cliente, type Lancamento } from "@/lib/schemas";
import { brl, dataBR } from "@/lib/calc";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro | Ideal Jairo" },
      {
        name: "description",
        content:
          "Contas a pagar e a receber da Oficina Ideal Jairo, com baixa de pagamentos, formas de pagamento e saldo do período.",
      },
      { property: "og:title", content: "Financeiro | Ideal Jairo" },
      {
        property: "og:description",
        content: "Controle o caixa da oficina: recebimentos, despesas e vencimentos.",
      },
    ],
  }),
  component: FinanceiroPage,
});

const hoje = () => new Date().toISOString().slice(0, 10);

const vazio = {
  tipo: "receber" as const,
  descricao: "",
  valor: 0,
  valorPago: 0,
  vencimento: hoje(),
  pagoEm: "",
  formaPagamento: "PIX" as const,
  categoria: "Serviços",
  observacao: "",
  osId: "",
  clienteId: "",
};

type StatusFiltro = "Todos" | "Em aberto" | "Em atraso" | "Pago parcial" | "Pago" | "A pagar";

function statusLancamento(l: Lancamento): string {
  const vp = l.valorPago ?? 0;
  if (l.valor > 0 && vp >= l.valor) return "Pago";
  if (vp > 0) return "Pago parcial";
  if (l.vencimento < hoje()) return "Em atraso";
  return "Em aberto";
}

function FinanceiroPage() {
  const { usuario, pode } = useAuth();
  const { dados: lancamentos, salvar, remover } = useColecao<Lancamento>("lancamentos");
  const { dados: clientes } = useColecao<Cliente>("clientes");
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [filtroStatus, setFiltroStatus] = useState<StatusFiltro>("Todos");
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Lancamento | null>(null);
  const [modalBaixa, setModalBaixa] = useState<Lancamento | null>(null);
  const [modalBaixaValor, setModalBaixaValor] = useState("");
  const form = useFormularioZod(lancamentoSchema, vazio);

  // Form de edição local
  const [formEdit, setFormEdit] = useState<Partial<Lancamento>>({});

  const doMes = useMemo(
    () =>
      lancamentos
        .filter((l) => l.vencimento.startsWith(mes))
        .filter((l) => filtroTipo === "Todos" || l.tipo === filtroTipo)
        .filter((l) => {
          if (filtroStatus === "Todos") return true;
          if (filtroStatus === "A pagar") return l.tipo === "pagar";
          return statusLancamento(l) === filtroStatus;
        })
        .sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
    [lancamentos, mes, filtroTipo, filtroStatus],
  );

  const totais = useMemo(() => {
    const doPeriodo = lancamentos.filter((l) => l.vencimento.startsWith(mes));
    const receber = doPeriodo.filter((l) => l.tipo === "receber");
    const pagar = doPeriodo.filter((l) => l.tipo === "pagar");
    const soma = (arr: Lancamento[]) => arr.reduce((s, l) => s + l.valor, 0);
    const somaVP = (arr: Lancamento[]) => arr.reduce((s, l) => s + (l.valorPago ?? 0), 0);
    return {
      receber: soma(receber),
      recebido: somaVP(receber),
      pagar: soma(pagar),
      pago: somaVP(pagar),
      saldo: soma(receber) - soma(pagar),
    };
  }, [lancamentos, mes]);

  async function confirmar() {
    const dados = form.validar();
    if (!dados) {
      toast.error("Corrija os campos destacados.");
      return;
    }
    await salvar({ ...dados, id: novoId() }, usuario?.nome ?? "sistema");
    setAberto(false);
    toast.success("Lançamento criado.");
  }

  async function baixar(l: Lancamento) {
    const novoVP = l.valorPago && l.valorPago >= l.valor ? 0 : l.valor;
    const novoPayoEm = novoVP >= l.valor ? hoje() : "";
    await salvar(
      { ...l, valorPago: novoVP, pagoEm: novoPayoEm },
      usuario?.nome ?? "sistema",
    );
    toast.success(novoVP === 0 ? "Baixa desfeita." : "Baixa registrada.");
  }

  async function baixarParcial() {
    const l = modalBaixa;
    if (!l) return;
    const recebidoAgora = Number(modalBaixaValor) || 0;
    if (recebidoAgora <= 0) { toast.error("Informe um valor maior que zero."); return; }
    const novoVP = (l.valorPago ?? 0) + recebidoAgora;
    const pagoEm = novoVP >= l.valor ? hoje() : (l.pagoEm || "");
    await salvar({ ...l, valorPago: Math.min(novoVP, l.valor), pagoEm }, usuario?.nome ?? "sistema");
    toast.success(novoVP >= l.valor ? "Pago integralmente." : `Pago parcial: ${brl(Math.min(novoVP, l.valor))} de ${brl(l.valor)}.`);
    setModalBaixa(null);
    setModalBaixaValor("");
  }

  function abrirEdicao(l: Lancamento) {
    setFormEdit({ ...l });
    setEditando(l);
  }

  async function salvarEdicao() {
    if (!editando) return;
    const atualizado: Lancamento = {
      ...editando,
      ...formEdit,
      valorPago: Number(formEdit.valorPago) || 0,
      valor: Number(formEdit.valor) || editando.valor,
      pagoEm:
        (Number(formEdit.valorPago) || 0) >= (Number(formEdit.valor) || editando.valor)
          ? formEdit.pagoEm || hoje()
          : "",
    } as Lancamento;
    await salvar(atualizado, usuario?.nome ?? "sistema");
    setEditando(null);
    toast.success("Lançamento atualizado.");
  }

  const corStatus = (s: string) => {
    if (s === "Pago") return "text-success";
    if (s === "Pago parcial") return "text-warning";
    if (s === "Em atraso") return "text-destructive";
    return "text-muted-foreground";
  };

  const Indicador = ({ titulo, valor, cor }: { titulo: string; valor: string; cor: string }) => (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <p className={`font-display text-2xl font-bold ${cor}`}>{valor}</p>
      </CardContent>
    </Card>
  );

  return (
    <AppLayout
      titulo="Financeiro"
      descricao="Contas a receber e a pagar, geradas automaticamente pelas OS e compras."
      acoes={
        <>
          <Input
            type="month"
            className="w-40"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
          />
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
          >
            <option value="Todos">Todos</option>
            <option value="receber">A receber</option>
            <option value="pagar">A pagar</option>
          </select>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as StatusFiltro)}
          >
            <option value="Todos">Todos os status</option>
            <option value="Em aberto">Em aberto</option>
            <option value="Em atraso">Em atraso</option>
            <option value="Pago parcial">Pago parcial</option>
            <option value="Pago">Pago</option>
            <option value="A pagar">A pagar</option>
          </select>
          <Button
            size="sm"
            onClick={() => {
              form.reset({ ...vazio, vencimento: hoje() });
              setAberto(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Lançamento
          </Button>
        </>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador titulo="A receber no mês" valor={brl(totais.receber)} cor="text-success" />
        <Indicador titulo="Já recebido" valor={brl(totais.recebido)} cor="text-foreground" />
        <Indicador titulo="A pagar no mês" valor={brl(totais.pagar)} cor="text-destructive" />
        <Indicador
          titulo="Resultado previsto"
          valor={brl(totais.saldo)}
          cor={totais.saldo >= 0 ? "text-primary" : "text-destructive"}
        />
      </div>

      {doMes.length === 0 ? (
        <Vazio mensagem="Nenhum lançamento neste período." />
      ) : (
        <div className="space-y-2">
          {doMes.map((l) => {
            const cliente = clientes.find((c) => c.id === l.clienteId);
            const st = statusLancamento(l);
            const vp = l.valorPago ?? 0;
            return (
              <Card key={l.id}>
                <CardContent className="flex flex-wrap items-center gap-3 p-3">
                  {l.tipo === "receber" ? (
                    <ArrowUpCircle className="h-5 w-5 text-success" />
                  ) : (
                    <ArrowDownCircle className="h-5 w-5 text-destructive" />
                  )}
                  <div className="min-w-52 flex-1">
                    <p className="font-medium">{l.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      Venc. {dataBR(l.vencimento)} · {l.categoria} · {l.formaPagamento}
                      {cliente ? ` · ${cliente.nome}` : ""}
                      {l.osId ? ` · Ref: ${l.osId.slice(0, 12)}` : ""}
                    </p>
                    {l.observacao ? (
                      <p className="text-xs text-muted-foreground italic">{l.observacao}</p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <span
                      className={`font-display text-lg font-bold ${l.tipo === "receber" ? "text-success" : "text-destructive"}`}
                    >
                      {brl(l.valor)}
                    </span>
                    {vp > 0 ? (
                      <p className="text-xs text-muted-foreground">Pago: {brl(vp)}</p>
                    ) : null}
                    {vp < l.valor ? (
                      <p className="text-xs font-medium text-warning">Saldo: {brl(l.valor - vp)}</p>
                    ) : null}
                  </div>
                  <Badge variant="secondary" className={corStatus(st)}>
                    {st}
                  </Badge>
                  {l.valor > 0 && vp >= l.valor ? (
                    <Button size="sm" variant="outline" onClick={() => void baixar(l)}>
                      <Check className="mr-1 h-4 w-4" /> Reabrir
                    </Button>
                  ) : (
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => void baixar(l)}>
                        <Check className="mr-1 h-4 w-4" /> Pago total
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setModalBaixa(l); setModalBaixaValor(""); }}>
                        Parcial
                      </Button>
                    </div>
                  )}
                  <Button size="sm" variant="outline" onClick={() => abrirEdicao(l)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {pode("excluir") ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        void remover(l.id, usuario?.nome ?? "sistema");
                        toast.success("Lançamento excluído.");
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal criar lançamento */}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo lançamento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Tipo" erro={form.erros["tipo"]}>
              <Select
                value={String(form.valores["tipo"] ?? "receber")}
                onValueChange={(v) => form.set("tipo", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receber">Conta a receber</SelectItem>
                  <SelectItem value="pagar">Conta a pagar</SelectItem>
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="Forma de pagamento" erro={form.erros["formaPagamento"]}>
              <Select
                value={String(form.valores["formaPagamento"] ?? "PIX")}
                onValueChange={(v) => form.set("formaPagamento", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Dinheiro", "PIX", "Débito", "Crédito", "Boleto", "Transferência"].map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <CampoTexto
              label="Descrição"
              className="sm:col-span-2"
              valor={String(form.valores["descricao"] ?? "")}
              erro={form.erros["descricao"]}
              onChange={(v) => form.set("descricao", v)}
            />
<CampoTexto
  label="Valor total (R$)"
  type="number"
  valor={form.valores["valor"] ? String(form.valores["valor"]) : ""}
  erro={form.erros["valor"]}
  onChange={(v) => form.set("valor", Number(v))}
/>
<CampoTexto
  label="Valor pago (R$)"
  type="number"
  valor={form.valores["valorPago"] ? String(form.valores["valorPago"]) : ""}
  onChange={(v) => form.set("valorPago", Number(v))}
/>
            <CampoTexto
              label="Vencimento"
              type="date"
              valor={String(form.valores["vencimento"] ?? "")}
              erro={form.erros["vencimento"]}
              onChange={(v) => form.set("vencimento", v)}
            />
            <CampoTexto
              label="Categoria"
              valor={String(form.valores["categoria"] ?? "")}
              erro={form.erros["categoria"]}
              onChange={(v) => form.set("categoria", v)}
            />
            <CampoTexto
              label="Observação (opcional)"
              className="sm:col-span-2"
              valor={String(form.valores["observacao"] ?? "")}
              onChange={(v) => form.set("observacao", v)}
            />
            <Campo label="Cliente (opcional)" erro={form.erros["clienteId"]}>
              <Select
                value={String(form.valores["clienteId"] ?? "") || "nenhum"}
                onValueChange={(v) => form.set("clienteId", v === "nenhum" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Sem cliente</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void confirmar()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal editar lançamento */}
      <Dialog open={!!editando} onOpenChange={(v) => { if (!v) setEditando(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar lançamento</DialogTitle>
          </DialogHeader>
          {editando ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">Descrição</label>
                <Input
                  value={formEdit.descricao ?? ""}
                  onChange={(e) => setFormEdit((f) => ({ ...f, descricao: e.target.value }))}
                />
              </div>
<div>
  <label className="mb-1 block text-sm font-medium">Valor total (R$)</label>
  <Input
    type="number"
    value={formEdit.valor || ""}
    onChange={(e) => setFormEdit((f) => ({ ...f, valor: Number(e.target.value) }))}
  />
</div>
<div>
  <label className="mb-1 block text-sm font-medium">Valor pago (R$)</label>
  <Input
    type="number"
    value={formEdit.valorPago || ""}
    onChange={(e) => setFormEdit((f) => ({ ...f, valorPago: Number(e.target.value) }))}
  />
                {(() => {
                  const vp = Number(formEdit.valorPago) || 0;
                  const vt = Number(formEdit.valor) || 0;
                  if (vp >= vt && vt > 0) return <p className="mt-1 text-xs text-success">✓ Pago integralmente</p>;
                  if (vp > 0) return <p className="mt-1 text-xs text-warning">Pago parcial: {brl(vp)} de {brl(vt)}</p>;
                  return null;
                })()}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Vencimento</label>
                <Input
                  type="date"
                  value={formEdit.vencimento ?? ""}
                  onChange={(e) => setFormEdit((f) => ({ ...f, vencimento: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Data de pagamento</label>
                <Input
                  type="date"
                  value={formEdit.pagoEm ?? ""}
                  onChange={(e) => setFormEdit((f) => ({ ...f, pagoEm: e.target.value }))}
                />
              </div>
              <Campo label="Forma de pagamento">
                <Select
                  value={formEdit.formaPagamento ?? "PIX"}
                  onValueChange={(v) => setFormEdit((f) => ({ ...f, formaPagamento: v as Lancamento["formaPagamento"] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Dinheiro", "PIX", "Débito", "Crédito", "Boleto", "Transferência"].map((fp) => (
                      <SelectItem key={fp} value={fp}>{fp}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">Observação</label>
                <Input
                  value={formEdit.observacao ?? ""}
                  onChange={(e) => setFormEdit((f) => ({ ...f, observacao: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2 rounded-md bg-muted p-3 text-sm">
                <strong>Status calculado: </strong>
                <span className={corStatus(statusLancamento({ ...editando, ...formEdit, valorPago: Number(formEdit.valorPago) || 0, valor: Number(formEdit.valor) || editando.valor } as Lancamento))}>
                  {statusLancamento({ ...editando, ...formEdit, valorPago: Number(formEdit.valorPago) || 0, valor: Number(formEdit.valor) || editando.valor } as Lancamento)}
                </span>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void salvarEdicao()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Modal baixa parcial */}
      <Dialog open={!!modalBaixa} onOpenChange={(v) => { if (!v) { setModalBaixa(null); setModalBaixaValor(""); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar pagamento parcial</DialogTitle>
          </DialogHeader>
          {modalBaixa ? (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <p className="font-medium">{modalBaixa.descricao}</p>
                <p className="text-muted-foreground">Total: <strong className="text-foreground">{brl(modalBaixa.valor)}</strong></p>
                {(modalBaixa.valorPago ?? 0) > 0 ? (
                  <p className="text-muted-foreground">Já pago: <strong className="text-foreground">{brl(modalBaixa.valorPago ?? 0)}</strong></p>
                ) : null}
                <p className="text-warning font-medium">Saldo restante: {brl(modalBaixa.valor - (modalBaixa.valorPago ?? 0))}</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Valor recebido agora (R$)</label>
                <Input
                  type="number"
                  autoFocus
                  placeholder="0,00"
                  value={modalBaixaValor}
                  onChange={(e) => setModalBaixaValor(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void baixarParcial(); }}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setModalBaixa(null); setModalBaixaValor(""); }}>
              Cancelar
            </Button>
            <Button onClick={() => void baixarParcial()}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}