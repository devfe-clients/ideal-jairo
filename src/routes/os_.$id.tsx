import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Camera,
  CheckCircle2,
  CheckSquare,
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
import { contaReceberDaOS, mensagemOrcamento, mensagemPronto, proximoNumero } from "@/lib/os-helpers";
import { ITENS_VISTORIA, NIVEIS_COMBUSTIVEL } from "@/lib/empresa";
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
  const { salvar: salvarLancamento } = useColecao<Lancamento>("lancamentos");

  const original = ordens.find((o) => o.id === id);
  const [osState, setOS] = useState<OrdemServico | null>(null);

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
    //baixa de estoque apenas das peças próprias da oficina
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
    await salvarLancamento(contaReceberDaOS(atualizada), usuario?.uid ?? "sistema");
    await salvarOS(atualizada, usuario?.uid ?? "sistema");
    setOS(atualizada);
    toast.success("OS finalizada: conta a receber criada e estoque baixado automaticamente.");
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
    atualizar(lado, { ...atual, [campo]: valor });
  }

  const BlocoChecklist = ({ lado, titulo }: { lado: "checklistEntrada" | "checklistSaida"; titulo: string }) => {
    const c = os[lado] ?? checklistVazio;
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{titulo}</CardTitle>
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
            {ITENS_VISTORIA.map((item) => (
              <div key={item} className="flex items-center gap-2">
                <span className="w-32 shrink-0 text-xs text-muted-foreground">{item}</span>
                <Input
                  className="h-8"
                  placeholder="OK / Arranhões..."
                  value={c.itens[item] ?? ""}
                  onChange={(e) =>
                    atualizarChecklist(lado, "itens", { ...c.itens, [item]: e.target.value })
                  }
                />
              </div>
            ))}
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
          <Button size="sm" variant="secondary" onClick={finalizar}>
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
          <div className="overflow-x-auto rounded-lg border border-border">
            <ImpressaoOS os={os} cliente={cliente} veiculo={veiculo} mecanicos={usuarios} />
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-1 h-4 w-4" /> Imprimir / salvar PDF
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
    </AppLayout>
  );
}
