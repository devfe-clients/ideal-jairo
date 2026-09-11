import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Check, Plus, Trash2 } from "lucide-react";
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
  vencimento: hoje(),
  pagoEm: "",
  formaPagamento: "PIX" as const,
  categoria: "Serviços",
  osId: "",
  clienteId: "",
};

function FinanceiroPage() {
  const { usuario, pode } = useAuth();
  const { dados: lancamentos, salvar, remover } = useColecao<Lancamento>("lancamentos");
  const { dados: clientes } = useColecao<Cliente>("clientes");
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [tipo, setTipo] = useState("Todos");
  const [aberto, setAberto] = useState(false);
  const form = useFormularioZod(lancamentoSchema, vazio);

  const doMes = useMemo(
    () =>
      lancamentos
        .filter((l) => l.vencimento.startsWith(mes))
        .filter((l) => tipo === "Todos" || l.tipo === tipo)
        .sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
    [lancamentos, mes, tipo],
  );

  const totais = useMemo(() => {
    const doPeriodo = lancamentos.filter((l) => l.vencimento.startsWith(mes));
    const receber = doPeriodo.filter((l) => l.tipo === "receber");
    const pagar = doPeriodo.filter((l) => l.tipo === "pagar");
    const soma = (arr: Lancamento[]) => arr.reduce((s, l) => s + l.valor, 0);
    return {
      receber: soma(receber),
      recebido: soma(receber.filter((l) => l.pagoEm)),
      pagar: soma(pagar),
      pago: soma(pagar.filter((l) => l.pagoEm)),
      saldo: soma(receber) - soma(pagar),
    };
  }, [lancamentos, mes]);

  async function confirmar() {
    const dados = form.validar();
    if (!dados) {
      toast.error("Corrija os campos destacados.");
      return;
    }
    await salvar({ ...dados, id: novoId() }, usuario.nome);
    setAberto(false);
    toast.success("Lançamento criado.");
  }

  async function baixar(l: Lancamento) {
    await salvar({ ...l, pagoEm: l.pagoEm ? "" : hoje() }, usuario.nome);
    toast.success(l.pagoEm ? "Baixa desfeita." : "Baixa registrada.");
  }

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
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
          >
            <option value="Todos">Todos</option>
            <option value="receber">A receber</option>
            <option value="pagar">A pagar</option>
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
            const atrasado = !l.pagoEm && l.vencimento < hoje();
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
                    </p>
                  </div>
                  <span
                    className={`font-display text-lg font-bold ${l.tipo === "receber" ? "text-success" : "text-destructive"}`}
                  >
                    {brl(l.valor)}
                  </span>
                  <Badge variant="secondary">
                    {l.pagoEm ? `Baixado ${dataBR(l.pagoEm)}` : atrasado ? "Em atraso" : "Em aberto"}
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => void baixar(l)}>
                    <Check className="mr-1 h-4 w-4" />
                    {l.pagoEm ? "Reabrir" : "Dar baixa"}
                  </Button>
                  {pode("excluir") ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        void remover(l.id, usuario.nome);
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
              label="Valor (R$)"
              type="number"
              valor={String(form.valores["valor"] ?? 0)}
              erro={form.erros["valor"]}
              onChange={(v) => form.set("valor", Number(v) || 0)}
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
    </AppLayout>
  );
}
