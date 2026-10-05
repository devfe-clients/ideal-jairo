import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { NavigateOptions } from "@tanstack/react-router";
import { useState } from "react";
import { Car, FileText, MessageCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CampoArea, CampoTexto, Vazio, useFormularioZod } from "@/components/form-kit";
import { useColecao, novoId } from "@/lib/db";
import { clienteSchema, type Cliente, type OrdemServico, type Veiculo } from "@/lib/schemas";
import { brl, dataBR, formatarDoc, formatarTelefone, linkWhatsApp, soDigitos, totaisOS } from "@/lib/calc";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/clientes_/$id")({
  head: () => ({
    meta: [{ title: "Detalhe do cliente | Oficina Ideal Jairo" }],
  }),
  component: DetalheCliente,
});

const vazio = {
  nome: "",
  cpfCnpj: "",
  telefone: "",
  email: "",
  cep: "",
  endereco: "",
  numero: "",
  bairro: "",
  cidade: "Praia Grande",
  uf: "SP",
  observacoes: "",
  consentimentoLgpd: true,
};

function DetalheCliente() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { dados: clientes, salvar, remover } = useColecao<Cliente>("clientes");
  const { dados: veiculos } = useColecao<Veiculo>("veiculos");
  const { dados: ordens, salvar: salvarOS } = useColecao<OrdemServico>("ordens");
  const { usuario, pode } = useAuth();
  const [editando, setEditando] = useState(false);
  const form = useFormularioZod(clienteSchema, vazio);

  const cliente = clientes.find((c) => c.id === id);
  const meusVeiculos = veiculos.filter((v) => v.clienteId === id);
  const minhasOS = ordens.filter((o) => o.clienteId === id && o.tipo === "os");
  const meusOrcamentos = ordens.filter((o) => o.clienteId === id && o.tipo === "orcamento");

  if (!cliente) {
    return (
      <AppLayout titulo="Cliente não encontrado">
        <Vazio mensagem="Este cliente não existe ou foi removido." />
        <Button className="mt-4" variant="outline" onClick={() => navigate({ to: "/clientes" })}>
          Voltar para clientes
        </Button>
      </AppLayout>
    );
  }

  function abrirEdicao() {
    form.reset({ ...cliente });
    setEditando(true);
  }

  async function submeter() {
    const dados = form.validar();
    if (!dados) {
      toast.error("Confira os campos destacados.");
      return;
    }
    const registro = { ...dados, id: cliente!.id, criadoEm: cliente!.criadoEm } as Cliente;
    await salvar(registro, usuario?.uid ?? "sistema");
    toast.success("Cliente atualizado.");
    setEditando(false);
  }

  return (
    <AppLayout
      titulo={cliente.nome}
      descricao={`${formatarDoc(cliente.cpfCnpj ?? "")} · ${formatarTelefone(cliente.telefone)}`}
      acoes={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={abrirEdicao}>
            <Pencil className="mr-1 h-4 w-4" /> Editar
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a
              href={linkWhatsApp(
                cliente.telefone,
                `Olá ${cliente.nome.split(" ")[0]}, aqui é da Oficina Ideal Jairo.`,
              )}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="mr-1 h-4 w-4" /> WhatsApp
            </a>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/veiculos" search={{ cliente: id } as Record<string, string>}>
              <Car className="mr-1 h-4 w-4" /> Veículos
            </Link>
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate({ to: "/veiculos", search: { cliente: id } } as NavigateOptions)}>
            <Plus className="mr-1 h-4 w-4" /> Cadastrar veículo
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void criarOS("os")}>
            <FileText className="mr-1 h-4 w-4" /> Nova OS
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void criarOS("orcamento")}>
            <FileText className="mr-1 h-4 w-4" /> Novo orçamento
          </Button>
          {pode("excluir") ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={async () => {
                await remover(id, usuario?.uid ?? "sistema");
                toast.success("Cliente excluído.");
                await navigate({ to: "/clientes" });
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Dados do cliente */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados cadastrais</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm sm:grid-cols-2">
            <p><span className="text-muted-foreground">CPF/CNPJ:</span> {formatarDoc(cliente.cpfCnpj ?? "")}</p>
            <p><span className="text-muted-foreground">Telefone:</span> {formatarTelefone(cliente.telefone)}</p>
            {cliente.email ? <p><span className="text-muted-foreground">E-mail:</span> {cliente.email}</p> : null}
            {cliente.endereco ? (
              <p className="sm:col-span-2">
                <span className="text-muted-foreground">Endereço:</span>{" "}
                {cliente.endereco}{cliente.numero ? `, ${cliente.numero}` : ""}{cliente.bairro ? ` - ${cliente.bairro}` : ""}{cliente.cidade ? ` - ${cliente.cidade}/${cliente.uf}` : ""}
              </p>
            ) : null}
            {cliente.observacoes ? (
              <p className="sm:col-span-2"><span className="text-muted-foreground">Obs.:</span> {cliente.observacoes}</p>
            ) : null}
            <p>
              {cliente.consentimentoLgpd ? (
                <Badge variant="outline" className="text-[10px]">LGPD ok</Badge>
              ) : (
                <Badge variant="destructive" className="text-[10px]">Sem consentimento LGPD</Badge>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Veículos */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Veículos ({meusVeiculos.length})</CardTitle>
              <Button size="sm" variant="outline" asChild>
                <Link to="/veiculos" search={{ cliente: id } as Record<string, string>}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Cadastrar veículo
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {meusVeiculos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum veículo cadastrado.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {meusVeiculos.map((v) => (
                  <Badge key={v.id} variant="secondary" className="text-xs">
                    {v.placa} · {v.marca} {v.modelo} ({v.ano})
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ordens de serviço */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Ordens de serviço ({minhasOS.length})</CardTitle>
              <Button size="sm" variant="outline" onClick={() => void criarOS("os")}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Nova OS
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {minhasOS.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma OS registrada.</p>
            ) : (
              <div className="space-y-2">
                {minhasOS.slice().sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).map((o) => {
                  const t = totaisOS(o, true);
                  const veiculo = veiculos.find((v) => v.id === o.veiculoId);
                  return (
                    <div key={o.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                      <div>
                        <p className="font-medium">{o.numero}</p>
                        <p className="text-xs text-muted-foreground">
                          {dataBR(o.emissao)} · {veiculo?.placa ?? "—"} · {o.status}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-primary">{brl(t.total)}</span>
                        <Button size="sm" variant="ghost" asChild>
                          <Link to="/os/$id" params={{ id: o.id }}>Abrir</Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Orçamentos */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Orçamentos ({meusOrcamentos.length})</CardTitle>
              <Button size="sm" variant="outline" onClick={() => void criarOS("orcamento")}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Novo orçamento
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {meusOrcamentos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum orçamento registrado.</p>
            ) : (
              <div className="space-y-2">
                {meusOrcamentos.slice().sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).map((o) => {
                  const t = totaisOS(o, true);
                  const veiculo = veiculos.find((v) => v.id === o.veiculoId);
                  return (
                    <div key={o.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                      <div>
                        <p className="font-medium">{o.numero}</p>
                        <p className="text-xs text-muted-foreground">
                          {dataBR(o.emissao)} · {veiculo?.placa ?? "—"} · {o.aprovacao}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-primary">{brl(t.total)}</span>
                        <Button size="sm" variant="ghost" asChild>
                          <Link to="/os/$id" params={{ id: o.id }}>Abrir</Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de edição */}
      <Dialog open={editando} onOpenChange={setEditando}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
            <DialogDescription>
              Todos os campos passam por validação (CPF/CNPJ e telefone conferidos).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              label="Nome completo"
              className="sm:col-span-2"
              valor={String(form.valores["nome"] ?? "")}
              erro={form.erros["nome"]}
              onChange={(v) => form.set("nome", v)}
            />
            <CampoTexto
              label="CPF / CNPJ (opcional)"
              valor={formatarDoc(String(form.valores["cpfCnpj"] ?? ""))}
              erro={form.erros["cpfCnpj"]}
              onChange={(v) => form.set("cpfCnpj", v)}
            />
            <CampoTexto
              label="Telefone / WhatsApp"
              valor={formatarTelefone(String(form.valores["telefone"] ?? ""))}
              erro={form.erros["telefone"]}
              onChange={(v) => form.set("telefone", v)}
            />
            <CampoTexto
              label="E-mail (opcional)"
              valor={String(form.valores["email"] ?? "")}
              erro={form.erros["email"]}
              onChange={(v) => form.set("email", v)}
            />
            <CampoTexto
              label="CEP"
              valor={String(form.valores["cep"] ?? "")}
              erro={form.erros["cep"]}
              onChange={(v) => form.set("cep", v)}
            />
            <CampoTexto
              label="Endereço"
              className="sm:col-span-2"
              valor={String(form.valores["endereco"] ?? "")}
              erro={form.erros["endereco"]}
              onChange={(v) => form.set("endereco", v)}
            />
            <CampoTexto
              label="Número"
              valor={String(form.valores["numero"] ?? "")}
              erro={form.erros["numero"]}
              onChange={(v) => form.set("numero", v)}
            />
            <CampoTexto
              label="Bairro"
              valor={String(form.valores["bairro"] ?? "")}
              erro={form.erros["bairro"]}
              onChange={(v) => form.set("bairro", v)}
            />
            <CampoTexto
              label="Cidade"
              valor={String(form.valores["cidade"] ?? "")}
              erro={form.erros["cidade"]}
              onChange={(v) => form.set("cidade", v)}
            />
            <CampoTexto
              label="UF"
              valor={String(form.valores["uf"] ?? "")}
              erro={form.erros["uf"]}
              onChange={(v) => form.set("uf", v.toUpperCase().slice(0, 2))}
            />
            <CampoArea
              label="Observações"
              className="sm:col-span-2"
              valor={String(form.valores["observacoes"] ?? "")}
              erro={form.erros["observacoes"]}
              onChange={(v) => form.set("observacoes", v)}
            />
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox
                checked={Boolean(form.valores["consentimentoLgpd"])}
                onCheckedChange={(v) => form.set("consentimentoLgpd", Boolean(v))}
              />
              Cliente autorizou o uso dos dados para atendimento (LGPD)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(false)}>Cancelar</Button>
            <Button onClick={submeter}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );

  async function criarOS(tipo: "os" | "orcamento") {
    const { novaOrdem } = await import("@/lib/os-helpers");
    const ordem = novaOrdem(ordens, tipo, id, "", 0, usuario?.uid ?? "sistema");
    await salvarOS(ordem, usuario?.uid ?? "sistema");
    toast.success(tipo === "os" ? "OS criada." : "Orçamento criado.");
    await navigate({ to: "/os/$id", params: { id: ordem.id } });
  }
}