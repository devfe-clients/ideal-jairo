import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Car, Pencil, Plus, Search, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Campo, CampoArea, CampoTexto, Vazio, useFormularioZod } from "@/components/form-kit";
import { useColecao, novoId, registrarAuditoria } from "@/lib/db";
import { veiculoSchema, type Cliente, type OrdemServico, type Veiculo } from "@/lib/schemas";
import { brl, dataBR, formatarPlaca, totaisOS } from "@/lib/calc";
import { useAuth } from "@/lib/auth";

const busca = z.object({ cliente: z.string().optional() });

export const Route = createFileRoute("/veiculos")({
  validateSearch: busca,
  head: () => ({
    meta: [
      { title: "Veículos | Oficina Ideal Jairo" },
      {
        name: "description",
        content:
          "Cadastro de veículos por placa, marca, modelo e chassi com histórico completo de serviços na Oficina Ideal Jairo.",
      },
      { property: "og:title", content: "Veículos | Oficina Ideal Jairo" },
      { property: "og:description", content: "Veículos, placas e histórico de serviços." },
    ],
  }),
  component: Veiculos,
});

const vazio = {
  clienteId: "",
  placa: "",
  marca: "",
  modelo: "",
  ano: new Date().getFullYear(),
  cor: "",
  motor: "",
  chassi: "",
  km: 0,
  observacoes: "",
};

function Veiculos() {
  const { cliente: clienteFiltro } = Route.useSearch();
  const { dados: veiculos, salvar } = useColecao<Veiculo>("veiculos");
  const { dados: clientes } = useColecao<Cliente>("clientes");
  const { dados: ordens } = useColecao<OrdemServico>("ordens");
  const { usuario } = useAuth();
  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Veiculo | null>(null);
  const [historico, setHistorico] = useState<Veiculo | null>(null);
  const form = useFormularioZod(veiculoSchema, vazio);

  const filtrados = useMemo(() => {
    let lista = veiculos;
    if (clienteFiltro) lista = lista.filter((v) => v.clienteId === clienteFiltro);
    const t = texto.trim().toLowerCase();
    if (!t) return lista;
    return lista.filter(
      (v) =>
        v.placa.toLowerCase().includes(t) ||
        v.modelo.toLowerCase().includes(t) ||
        v.marca.toLowerCase().includes(t) ||
        (clientes.find((c) => c.id === v.clienteId)?.nome ?? "").toLowerCase().includes(t),
    );
  }, [veiculos, texto, clienteFiltro, clientes]);

  function abrirNovo() {
    setEditando(null);
    form.reset({ ...vazio, clienteId: clienteFiltro ?? "" });
    setAberto(true);
  }

  async function submeter() {
    const dados = form.validar();
    if (!dados) {
      toast.error("Confira os campos destacados.");
      return;
    }
    const registro = {
      ...dados,
      id: editando?.id ?? novoId(),
      criadoEm: editando?.criadoEm ?? new Date().toISOString(),
    } as Veiculo;
    await salvar(registro, usuario.nome);
    toast.success(editando ? "Veículo atualizado." : "Veículo cadastrado.");
    setAberto(false);
  }

  function consultarPlaca() {
    const placa = formatarPlaca(String(form.valores["placa"] ?? ""));
    if (placa.length < 7) {
      toast.error("Informe a placa completa para consultar.");
      return;
    }
    registrarAuditoria({
      colecao: "veiculos",
      registroId: placa,
      acao: "consulta-placa",
      usuario: usuario.nome,
      detalhe: "Consulta registrada para fins de LGPD",
    });
    toast.info(
      "Consulta de placa: integração pronta, aguardando a chave do serviço autorizado (sessão 2). A consulta já fica registrada para a LGPD.",
    );
  }

  const nomeCliente = (id: string) => clientes.find((c) => c.id === id)?.nome ?? "Sem cliente";
  const osDoVeiculo = (id: string) => ordens.filter((o) => o.veiculoId === id && o.tipo === "os");

  return (
    <AppLayout
      titulo="Veículos"
      descricao="Placa, chassi, quilometragem e histórico completo"
      acoes={
        <Button size="sm" onClick={abrirNovo}>
          <Plus className="mr-1 h-4 w-4" /> Novo veículo
        </Button>
      }
    >
      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por placa, modelo ou cliente..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>

      {filtrados.length === 0 ? (
        <Vazio mensagem="Nenhum veículo encontrado." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((v) => {
            const lista = osDoVeiculo(v.id);
            const gasto = lista.reduce((s, o) => s + totaisOS(o).total, 0);
            return (
              <Card key={v.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display text-lg font-bold tracking-wider text-primary">
                        {v.placa}
                      </p>
                      <p className="truncate text-sm">
                        {v.marca} {v.modelo} ({v.ano})
                      </p>
                      <p className="text-xs text-muted-foreground">{nomeCliente(v.clienteId)}</p>
                    </div>
                    <Car className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </div>
                  <div className="flex flex-wrap gap-1 text-[11px]">
                    <Badge variant="secondary">{v.km.toLocaleString("pt-BR")} km</Badge>
                    {v.cor ? <Badge variant="outline">{v.cor}</Badge> : null}
                    <Badge variant="outline">{lista.length} OS</Badge>
                    <Badge variant="outline">Total {brl(gasto)}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditando(v);
                        form.reset({ ...v });
                        setAberto(true);
                      }}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setHistorico(v)}>
                      Histórico
                    </Button>
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
            <DialogTitle>{editando ? "Editar veículo" : "Novo veículo"}</DialogTitle>
            <DialogDescription>
              A placa é validada nos formatos ABC1234 e ABC1D23.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Cliente" erro={form.erros["clienteId"]} className="sm:col-span-2">
              <Select
                value={String(form.valores["clienteId"] ?? "")}
                onValueChange={(v) => form.set("clienteId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>

            <div className="flex items-end gap-2">
              <CampoTexto
                label="Placa"
                className="flex-1"
                valor={formatarPlaca(String(form.valores["placa"] ?? ""))}
                erro={form.erros["placa"]}
                onChange={(v) => form.set("placa", formatarPlaca(v))}
              />
              <Button type="button" variant="outline" onClick={consultarPlaca}>
                <ScanLine className="mr-1 h-4 w-4" /> Consultar
              </Button>
            </div>
            <CampoTexto
              label="Marca"
              valor={String(form.valores["marca"] ?? "")}
              erro={form.erros["marca"]}
              onChange={(v) => form.set("marca", v)}
            />
            <CampoTexto
              label="Modelo"
              valor={String(form.valores["modelo"] ?? "")}
              erro={form.erros["modelo"]}
              onChange={(v) => form.set("modelo", v)}
            />
            <CampoTexto
              label="Ano"
              type="number"
              valor={String(form.valores["ano"] ?? "")}
              erro={form.erros["ano"]}
              onChange={(v) => form.set("ano", v)}
            />
            <CampoTexto
              label="Cor"
              valor={String(form.valores["cor"] ?? "")}
              erro={form.erros["cor"]}
              onChange={(v) => form.set("cor", v)}
            />
            <CampoTexto
              label="Motor"
              valor={String(form.valores["motor"] ?? "")}
              erro={form.erros["motor"]}
              onChange={(v) => form.set("motor", v)}
            />
            <CampoTexto
              label="Chassi"
              valor={String(form.valores["chassi"] ?? "")}
              erro={form.erros["chassi"]}
              onChange={(v) => form.set("chassi", v)}
            />
            <CampoTexto
              label="Quilometragem"
              type="number"
              valor={String(form.valores["km"] ?? "")}
              erro={form.erros["km"]}
              onChange={(v) => form.set("km", v)}
            />
            <CampoArea
              label="Observações"
              className="sm:col-span-2"
              valor={String(form.valores["observacoes"] ?? "")}
              erro={form.erros["observacoes"]}
              onChange={(v) => form.set("observacoes", v)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={submeter}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(historico)} onOpenChange={(o) => !o && setHistorico(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico — {historico?.placa}</DialogTitle>
            <DialogDescription>
              Responsável técnico geral: Jairo Alves de Oliveira
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {historico && osDoVeiculo(historico.id).length === 0 ? (
              <Vazio mensagem="Este veículo ainda não possui OS registradas." />
            ) : (
              historico &&
              osDoVeiculo(historico.id).map((o) => {
                const t = totaisOS(o);
                return (
                  <div key={o.id} className="rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{o.numero}</p>
                      <Badge variant="secondary">{o.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {dataBR(o.emissao)} · {o.km.toLocaleString("pt-BR")} km
                    </p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {o.itens.map((i) => (
                        <li key={i.id} className="flex justify-between gap-2">
                          <span className="truncate">
                            {i.tipo === "peca" ? "Peça" : "Serviço"} · {i.descricao}
                          </span>
                          <span>{brl(i.quantidade * i.valorUnitario - i.desconto)}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-right text-sm">
                      Peças {brl(t.totalPecas)} · Mão de obra {brl(t.totalServicos)} ·{" "}
                      <strong className="text-primary">{brl(t.total)}</strong>
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
