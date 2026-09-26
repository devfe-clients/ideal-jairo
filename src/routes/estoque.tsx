import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Campo, CampoTexto, Vazio, useFormularioZod } from "@/components/form-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useColecao, novoId } from "@/lib/db";
import { pecaSchema, type Peca } from "@/lib/schemas";
import { brl } from "@/lib/calc";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque de peças | Ideal Jairo" },
      {
        name: "description",
        content:
          "Controle de estoque de peças da Oficina Ideal Jairo com custo, preço de venda, margem e alerta de estoque mínimo.",
      },
      { property: "og:title", content: "Estoque de peças | Ideal Jairo" },
      {
        property: "og:description",
        content: "Peças, custos, margens e alertas de reposição em um só lugar.",
      },
    ],
  }),
  component: EstoquePage,
});

const vazio = {
  nome: "",
  codigo: "",
  marca: "",
  fornecedor: "",
  custo: 0,
  precoVenda: 0,
  quantidade: 0,
  estoqueMinimo: 1,
  localizacao: "",
  observacoes: "",
};

function EstoquePage() {
  const { usuario, pode } = useAuth();
  const { dados: pecas, salvar, remover } = useColecao<Peca>("pecas");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Peca | null>(null);
  const form = useFormularioZod(pecaSchema, vazio);

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return pecas
      .filter(
        (p) =>
          !t ||
          p.nome.toLowerCase().includes(t) ||
          (p.codigo ?? "").toLowerCase().includes(t) ||
          (p.marca ?? "").toLowerCase().includes(t),
      )
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [pecas, busca]);

  const valorEstoque = pecas.reduce((s, p) => s + p.custo * p.quantidade, 0);
  const abaixo = pecas.filter((p) => p.quantidade <= p.estoqueMinimo);

  function abrir(peca?: Peca) {
    setEditando(peca ?? null);
    form.reset(peca ? { ...peca } : { ...vazio });
    setAberto(true);
  }

async function confirmar() {
  const dados = form.validar();
  if (!dados) {
    toast.error("Corrija os campos destacados.");
    return;
  }
  const registro: Peca = { ...dados, id: editando?.id ?? novoId() };
  await salvar(registro, usuario?.nome ?? "sistema");
  setAberto(false);
  toast.success(editando ? "Peça atualizada." : "Peça cadastrada.");
}

  return (
    <AppLayout
      titulo="Estoque de peças"
      descricao={`${pecas.length} itens · valor investido ${brl(valorEstoque)}`}
      acoes={
        <>
          <Input
            placeholder="Buscar peça, código ou marca"
            className="w-56"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <Button size="sm" onClick={() => abrir()}>
            <Plus className="mr-1 h-4 w-4" /> Nova peça
          </Button>
        </>
      }
    >
      {abaixo.length > 0 ? (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-warning" />
          {abaixo.length} peça(s) no estoque mínimo: {abaixo.map((p) => p.nome).join(", ")}
        </div>
      ) : null}

      {lista.length === 0 ? (
        <Vazio mensagem="Nenhuma peça encontrada." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((p) => {
            const margem = (p.precoVenda - p.custo) * p.quantidade;
            return (
              <Card key={p.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {[p.codigo, p.marca, p.localizacao].filter(Boolean).join(" · ") ||
                          "Sem código cadastrado"}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={
                        p.quantidade <= p.estoqueMinimo ? "bg-warning/15 text-warning" : ""
                      }
                    >
                      <Package className="mr-1 h-3 w-3" />
                      {p.quantidade} un
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-sm">
                    <span className="text-muted-foreground">Venda</span>
                    <span className="text-right font-medium">{brl(p.precoVenda)}</span>
{pode("ver-margem") ? (
  <>
    <span className="text-muted-foreground">Custo</span>
    <span className="text-right">{brl(p.custo)}</span>
    {(() => {
      const margemPct = p.custo > 0 ? ((p.precoVenda - p.custo) / p.custo) * 100 : 0;
      const qualidade =
        margemPct >= 60
          ? { label: "▲ Boa", cor: "text-success" }
          : margemPct >= 30
          ? { label: "▶ Razoável", cor: "text-warning" }
          : { label: "▼ Baixa", cor: "text-destructive" };
      return (
        <>
          <span className="text-muted-foreground">Margem unit.</span>
          <span className={`text-right font-medium ${qualidade.cor}`}>
            {margemPct.toFixed(0)}% {qualidade.label}
          </span>
        </>
      );
    })()}
    <span className="text-muted-foreground">Margem no estoque</span>
    <span className="text-right text-success">{brl(margem)}</span>
  </>
) : null}
                    <span className="text-muted-foreground">Estoque mínimo</span>
                    <span className="text-right">{p.estoqueMinimo}</span>
                  </div>
                  <div className="flex justify-end gap-1 pt-1">
                    <Button size="sm" variant="ghost" onClick={() => abrir(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {pode("excluir") ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
onClick={() => {
  remover(p.id, usuario?.nome ?? "sistema").then(() => toast.success("Peça excluída.")).catch(() => toast.error("Erro ao excluir."));
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
            <DialogTitle>{editando ? "Editar peça" : "Nova peça"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoTexto
              label="Nome da peça"
              className="sm:col-span-2"
              valor={String(form.valores["nome"] ?? "")}
              erro={form.erros["nome"]}
              onChange={(v) => form.set("nome", v)}
            />
            <CampoTexto
              label="Código"
              valor={String(form.valores["codigo"] ?? "")}
              erro={form.erros["codigo"]}
              onChange={(v) => form.set("codigo", v)}
            />
            <CampoTexto
              label="Marca"
              valor={String(form.valores["marca"] ?? "")}
              erro={form.erros["marca"]}
              onChange={(v) => form.set("marca", v)}
            />
            <CampoTexto
              label="Fornecedor"
              valor={String(form.valores["fornecedor"] ?? "")}
              erro={form.erros["fornecedor"]}
              onChange={(v) => form.set("fornecedor", v)}
            />
            <CampoTexto
              label="Localização"
              valor={String(form.valores["localizacao"] ?? "")}
              erro={form.erros["localizacao"]}
              onChange={(v) => form.set("localizacao", v)}
            />
            <CampoTexto
              label="Custo (R$)"
              type="number"
              valor={String(form.valores["custo"] ?? 0)}
              erro={form.erros["custo"]}
              onChange={(v) => form.set("custo", Number(v) || 0)}
            />
            <CampoTexto
              label="Preço de venda (R$)"
              type="number"
              valor={String(form.valores["precoVenda"] ?? 0)}
              erro={form.erros["precoVenda"]}
              onChange={(v) => form.set("precoVenda", Number(v) || 0)}
            />
            <CampoTexto
              label="Quantidade"
              type="number"
              valor={String(form.valores["quantidade"] ?? 0)}
              erro={form.erros["quantidade"]}
              onChange={(v) => form.set("quantidade", Number(v) || 0)}
            />
            <CampoTexto
              label="Estoque mínimo"
              type="number"
              valor={String(form.valores["estoqueMinimo"] ?? 0)}
              erro={form.erros["estoqueMinimo"]}
              onChange={(v) => form.set("estoqueMinimo", Number(v) || 0)}
            />
            <Campo label="Observações" className="sm:col-span-2">
              <Textarea
                rows={2}
                value={String(form.valores["observacoes"] ?? "")}
                onChange={(e) => form.set("observacoes", e.target.value)}
              />
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
