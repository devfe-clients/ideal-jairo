import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Pencil, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Campo, CampoTexto, Vazio, useFormularioZod } from "@/components/form-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  compraSchema,
  compraStatus,
  type Compra,
  type Lancamento,
  type OrdemServico,
  type Peca,
} from "@/lib/schemas";
import { brl, dataBR } from "@/lib/calc";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/compras")({
  head: () => ({
    meta: [
      { title: "Compras de peças | Ideal Jairo" },
      {
        name: "description",
        content:
          "Solicitações de peças nas autopeças, status de entrega, vínculo com a OS e geração automática de contas a pagar.",
      },
      { property: "og:title", content: "Compras de peças | Ideal Jairo" },
      {
        property: "og:description",
        content: "Acompanhe pedidos, prazos e custos das peças compradas para cada serviço.",
      },
    ],
  }),
  component: ComprasPage,
});

const hoje = () => new Date().toISOString().slice(0, 10);

const vazio = {
  osId: "",
  descricao: "",
  fornecedor: "",
  quantidade: 1,
  valorPago: 0,
  valorVenda: 0,
  status: "A comprar" as const,
  dataSolicitacao: hoje(),
  previsaoEntrega: "",
  nota: "",
  paraEstoque: false,
};

function ComprasPage() {
  const { usuario, pode } = useAuth();
  const { dados: compras, salvar, remover } = useColecao<Compra>("compras");
  const { dados: ordens } = useColecao<OrdemServico>("ordens");
  const { dados: pecas, salvar: salvarPeca } = useColecao<Peca>("pecas");
  const { salvar: salvarLancamento } = useColecao<Lancamento>("lancamentos");
  const [filtro, setFiltro] = useState("Todos");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Compra | null>(null);
  const form = useFormularioZod(compraSchema, vazio);

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return compras
      .filter((c) => filtro === "Todos" || c.status === filtro)
      .filter(
        (c) =>
          !t ||
          c.descricao.toLowerCase().includes(t) ||
          c.fornecedor.toLowerCase().includes(t),
      )
      .sort((a, b) => b.dataSolicitacao.localeCompare(a.dataSolicitacao));
  }, [compras, filtro, busca]);

  const totalAberto = compras
    .filter((c) => !["Recebida", "Instalada", "Devolvida/Cancelada"].includes(c.status))
    .reduce((s, c) => s + c.valorPago * c.quantidade, 0);

  function abrir(compra?: Compra) {
    setEditando(compra ?? null);
    form.reset(compra ? { ...compra } : { ...vazio, dataSolicitacao: hoje() });
    setAberto(true);
  }

  async function confirmar() {
    const dados = form.validar();
    if (!dados) {
      toast.error("Corrija os campos destacados.");
      return;
    }
    const registro: Compra = { ...dados, id: editando?.id ?? novoId() };
    await salvar(registro, usuario.nome);
    setAberto(false);
    toast.success(editando ? "Compra atualizada." : "Compra registrada.");
  }

  async function receber(c: Compra) {
    await salvar({ ...c, status: "Recebida" }, usuario.nome);
    await salvarLancamento(
      {
        id: novoId(),
        tipo: "pagar",
        descricao: `Peça: ${c.descricao} (${c.fornecedor})`,
        valor: c.valorPago * c.quantidade,
        vencimento: hoje(),
        pagoEm: "",
        formaPagamento: "PIX",
        categoria: "Peças",
        osId: c.osId ?? "",
        clienteId: "",
      },
      usuario.nome,
    );
    if (c.paraEstoque) {
      const existente = pecas.find(
        (p) => p.nome.toLowerCase() === c.descricao.toLowerCase(),
      );
      if (existente) {
        await salvarPeca(
          { ...existente, quantidade: existente.quantidade + c.quantidade, custo: c.valorPago },
          usuario.nome,
        );
      } else {
        await salvarPeca(
          {
            id: novoId(),
            nome: c.descricao,
            codigo: "",
            marca: "",
            fornecedor: c.fornecedor,
            custo: c.valorPago,
            precoVenda: c.valorVenda || c.valorPago * 1.6,
            quantidade: c.quantidade,
            estoqueMinimo: 1,
            localizacao: "",
            observacoes: `Entrada pela compra de ${dataBR(c.dataSolicitacao)}.`,
          },
          usuario.nome,
        );
      }
    }
    toast.success("Peça recebida: conta a pagar criada e estoque atualizado.");
  }

  return (
    <AppLayout
      titulo="Compras de peças"
      descricao={`${compras.length} pedidos · ${brl(totalAberto)} em pedidos abertos`}
      acoes={
        <>
          <Input
            placeholder="Buscar peça ou fornecedor"
            className="w-56"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          >
            {["Todos", ...compraStatus].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <Button size="sm" onClick={() => abrir()}>
            <Plus className="mr-1 h-4 w-4" /> Nova compra
          </Button>
        </>
      }
    >
      {lista.length === 0 ? (
        <Vazio mensagem="Nenhuma compra registrada com esse filtro." />
      ) : (
        <div className="space-y-3">
          {lista.map((c) => {
            const os = ordens.find((o) => o.id === c.osId);
            return (
              <Card key={c.id}>
                <CardContent className="flex flex-wrap items-center gap-4 p-4">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  <div className="min-w-52 flex-1">
                    <p className="font-medium">
                      {c.quantidade}x {c.descricao}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {c.fornecedor} · pedido em {dataBR(c.dataSolicitacao)}
                      {c.previsaoEntrega ? ` · previsão ${dataBR(c.previsaoEntrega)}` : ""}
                      {os ? ` · ${os.numero}` : c.paraEstoque ? " · para estoque" : ""}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p>
                      Venda: <strong>{brl(c.valorVenda * c.quantidade)}</strong>
                    </p>
                    {pode("ver-margem") ? (
                      <p className="text-muted-foreground">
                        Custo {brl(c.valorPago * c.quantidade)} · margem{" "}
                        <span className="text-success">
                          {brl((c.valorVenda - c.valorPago) * c.quantidade)}
                        </span>
                      </p>
                    ) : null}
                  </div>
                  <Badge variant="secondary">{c.status}</Badge>
                  <div className="flex gap-1">
                    {c.status !== "Recebida" && c.status !== "Instalada" ? (
                      <Button size="sm" variant="outline" onClick={() => void receber(c)}>
                        Receber
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={() => abrir(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {pode("excluir") ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          void remover(c.id, usuario.nome);
                          toast.success("Compra excluída.");
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar compra" : "Nova compra de peça"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoTexto
              label="Descrição da peça"
              className="sm:col-span-2"
              valor={String(form.valores["descricao"] ?? "")}
              erro={form.erros["descricao"]}
              onChange={(v) => form.set("descricao", v)}
            />
            <CampoTexto
              label="Fornecedor / autopeças"
              valor={String(form.valores["fornecedor"] ?? "")}
              erro={form.erros["fornecedor"]}
              onChange={(v) => form.set("fornecedor", v)}
            />
            <Campo label="Vincular à OS" erro={form.erros["osId"]}>
              <Select
                value={String(form.valores["osId"] ?? "") || "nenhuma"}
                onValueChange={(v) => form.set("osId", v === "nenhuma" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">Sem OS (compra para estoque)</SelectItem>
                  {ordens.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.numero}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <CampoTexto
              label="Quantidade"
              type="number"
              valor={String(form.valores["quantidade"] ?? 1)}
              erro={form.erros["quantidade"]}
              onChange={(v) => form.set("quantidade", Number(v) || 0)}
            />
            <CampoTexto
              label="Valor pago (unitário)"
              type="number"
              valor={String(form.valores["valorPago"] ?? 0)}
              erro={form.erros["valorPago"]}
              onChange={(v) => form.set("valorPago", Number(v) || 0)}
            />
            <CampoTexto
              label="Valor de venda (unitário)"
              type="number"
              valor={String(form.valores["valorVenda"] ?? 0)}
              erro={form.erros["valorVenda"]}
              onChange={(v) => form.set("valorVenda", Number(v) || 0)}
            />
            <Campo label="Status" erro={form.erros["status"]}>
              <Select
                value={String(form.valores["status"] ?? "A comprar")}
                onValueChange={(v) => form.set("status", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {compraStatus.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <CampoTexto
              label="Data do pedido"
              type="date"
              valor={String(form.valores["dataSolicitacao"] ?? "")}
              erro={form.erros["dataSolicitacao"]}
              onChange={(v) => form.set("dataSolicitacao", v)}
            />
            <CampoTexto
              label="Previsão de entrega"
              type="date"
              valor={String(form.valores["previsaoEntrega"] ?? "")}
              erro={form.erros["previsaoEntrega"]}
              onChange={(v) => form.set("previsaoEntrega", v)}
            />
            <CampoTexto
              label="Nota fiscal / pedido"
              valor={String(form.valores["nota"] ?? "")}
              erro={form.erros["nota"]}
              onChange={(v) => form.set("nota", v)}
            />
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox
                checked={Boolean(form.valores["paraEstoque"])}
                onCheckedChange={(v) => form.set("paraEstoque", Boolean(v))}
              />
              Ao receber, dar entrada no estoque da oficina
            </label>
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
