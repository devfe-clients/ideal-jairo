import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MessageCircle, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import { clienteSchema, type Cliente, type Veiculo } from "@/lib/schemas";
import { formatarDoc, formatarTelefone, linkWhatsApp, soDigitos } from "@/lib/calc";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes | Oficina Ideal Jairo" },
      {
        name: "description",
        content:
          "Cadastro de clientes da Oficina Ideal Jairo com busca por nome, telefone ou CPF/CNPJ e histórico de atendimentos.",
      },
      { property: "og:title", content: "Clientes | Oficina Ideal Jairo" },
      { property: "og:description", content: "Cadastro e histórico de clientes da oficina." },
    ],
  }),
  component: Clientes,
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

function Clientes() {
  const { dados: clientes, salvar, remover } = useColecao<Cliente>("clientes");
  const { dados: veiculos } = useColecao<Veiculo>("veiculos");
  const { usuario, pode } = useAuth();
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const form = useFormularioZod(clienteSchema, vazio);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return clientes;
    const d = soDigitos(t);
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(t) ||
        (d && soDigitos(c.telefone).includes(d)) ||
        (d && soDigitos(c.cpfCnpj).includes(d)) ||
        veiculos.some((v) => v.clienteId === c.id && v.placa.toLowerCase().includes(t)),
    );
  }, [busca, clientes, veiculos]);

  function abrirNovo() {
    setEditando(null);
    form.reset(vazio);
    setAberto(true);
  }

  function abrirEdicao(c: Cliente) {
    setEditando(c);
    form.reset({ ...c });
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
    } as Cliente;
    await salvar(registro, usuario?.uid ?? "sistema");
    toast.success(editando ? "Cliente atualizado." : "Cliente cadastrado.");
    setAberto(false);
  }

  return (
    <AppLayout
      titulo="Clientes"
      descricao="Busque por nome, telefone, CPF/CNPJ ou placa"
      acoes={
        <Button size="sm" onClick={abrirNovo}>
          <Plus className="mr-1 h-4 w-4" /> Novo cliente
        </Button>
      }
    >
      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar cliente..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {filtrados.length === 0 ? (
        <Vazio mensagem="Nenhum cliente encontrado." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((c) => {
            const meus = veiculos.filter((v) => v.clienteId === c.id);
            return (
              <Card key={c.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{c.nome}</p>
                      <p className="text-xs text-muted-foreground">{formatarDoc(c.cpfCnpj)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatarTelefone(c.telefone)}
                      </p>
                    </div>
                    {c.consentimentoLgpd ? (
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        LGPD ok
                      </Badge>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {meus.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Sem veículo cadastrado</span>
                    ) : (
                      meus.map((v) => (
                        <Badge key={v.id} variant="secondary" className="text-[10px]">
                          {v.placa} · {v.modelo}
                        </Badge>
                      ))
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => abrirEdicao(c)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a
                        href={linkWhatsApp(
                          c.telefone,
                          `Olá ${c.nome.split(" ")[0]}, aqui é da Oficina Ideal Jairo.`,
                        )}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MessageCircle className="mr-1 h-3.5 w-3.5" /> WhatsApp
                      </a>
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <Link to="/veiculos" search={{ cliente: c.id }}>
                        Veículos
                      </Link>
                    </Button>
                    {pode("excluir") ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={async () => {
                          await remover(c.id, usuario?.uid ?? "sistema");
                          toast.success("Cliente excluído (registro em auditoria).");
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
            <DialogTitle>{editando ? "Editar cliente" : "Novo cliente"}</DialogTitle>
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
              label="CPF / CNPJ"
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
            <Button variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={submeter}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
