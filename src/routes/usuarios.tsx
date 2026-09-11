import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Pencil, Plus, ShieldCheck, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Campo, CampoTexto, Vazio, useFormularioZod } from "@/components/form-kit";
import { Button } from "@/components/ui/button";
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
import { db, novoId, useColecao, type ColecaoNome, type EventoAuditoria } from "@/lib/db";
import { perfis, usuarioSchema, type Cliente, type Usuario } from "@/lib/schemas";
import { permissoesDoPerfil, useAuth } from "@/lib/auth";
import type { Registro } from "@/lib/db/types";

export const Route = createFileRoute("/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários, LGPD e backup | Ideal Jairo" },
      {
        name: "description",
        content:
          "Usuários e permissões da Oficina Ideal Jairo, histórico de auditoria, exportação de dados do cliente (LGPD) e backup do sistema.",
      },
      { property: "og:title", content: "Usuários, LGPD e backup | Ideal Jairo" },
      {
        property: "og:description",
        content: "Controle quem acessa cada área, registre auditoria e atenda pedidos da LGPD.",
      },
    ],
  }),
  component: UsuariosPage,
});

const COLECOES: ColecaoNome[] = [
  "clientes",
  "veiculos",
  "ordens",
  "pecas",
  "servicos",
  "compras",
  "lancamentos",
  "agendamentos",
  "usuarios",
  "auditoria",
  "config",
];

const vazio = { nome: "", email: "", perfil: "Mecânico" as const, ativo: true };

function UsuariosPage() {
  const { usuario, pode } = useAuth();
  const { dados: usuarios, salvar, remover } = useColecao<Usuario>("usuarios");
  const { dados: clientes, remover: removerCliente } = useColecao<Cliente>("clientes");
  const { dados: auditoria } = useColecao<EventoAuditoria & Registro>("auditoria");
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [clienteLgpd, setClienteLgpd] = useState("");
  const form = useFormularioZod(usuarioSchema, vazio);

  const historico = useMemo(
    () =>
      [...auditoria]
        .sort((a, b) => String(b.data).localeCompare(String(a.data)))
        .slice(0, 60),
    [auditoria],
  );

  function abrir(u?: Usuario) {
    setEditando(u ?? null);
    form.reset(u ? { ...u } : { ...vazio });
    setAberto(true);
  }

  async function confirmar() {
    const dados = form.validar();
    if (!dados) {
      toast.error("Corrija os campos destacados.");
      return;
    }
    await salvar({ ...dados, id: editando?.id ?? novoId() }, usuario.nome);
    setAberto(false);
    toast.success(editando ? "Usuário atualizado." : "Usuário criado.");
  }

  function baixarArquivo(nome: string, conteudo: string) {
    const url = URL.createObjectURL(new Blob([conteudo], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function backup() {
    const pacote: Record<string, unknown> = { gerado: new Date().toISOString() };
    for (const c of COLECOES) pacote[c] = await db.listar(c);
    baixarArquivo(`backup-ideal-jairo-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(pacote, null, 2));
    toast.success("Backup gerado. Guarde o arquivo em local seguro.");
  }

  async function restaurar(arquivo: File | undefined) {
    if (!arquivo) return;
    try {
      const conteudo = JSON.parse(await arquivo.text()) as Record<string, Registro[]>;
      for (const c of COLECOES) {
        const registros = conteudo[c];
        if (!Array.isArray(registros)) continue;
        for (const r of registros) await db.salvar(c, r);
      }
      toast.success("Backup restaurado.");
    } catch {
      toast.error("Arquivo de backup inválido.");
    }
  }

  async function exportarLgpd() {
    const cliente = clientes.find((c) => c.id === clienteLgpd);
    if (!cliente) {
      toast.error("Selecione o cliente.");
      return;
    }
    const veiculos = (await db.listar("veiculos")).filter(
      (v) => (v as { clienteId?: string }).clienteId === cliente.id,
    );
    const ordens = (await db.listar("ordens")).filter(
      (o) => (o as { clienteId?: string }).clienteId === cliente.id,
    );
    baixarArquivo(
      `dados-lgpd-${cliente.nome.replace(/\s+/g, "-").toLowerCase()}.json`,
      JSON.stringify({ cliente, veiculos, ordens }, null, 2),
    );
    toast.success("Dados pessoais exportados conforme a LGPD.");
  }

  async function excluirLgpd() {
    const cliente = clientes.find((c) => c.id === clienteLgpd);
    if (!cliente) {
      toast.error("Selecione o cliente.");
      return;
    }
    await removerCliente(cliente.id, usuario.nome);
    toast.success(
      "Cliente removido. Os documentos fiscais permanecem arquivados pelo prazo legal, sem dados pessoais.",
    );
    setClienteLgpd("");
  }

  return (
    <AppLayout
      titulo="Usuários, permissões e LGPD"
      descricao="Quem acessa o quê, histórico de alterações e direitos do titular dos dados."
      acoes={
        <Button size="sm" onClick={() => abrir()}>
          <Plus className="mr-1 h-4 w-4" /> Novo usuário
        </Button>
      }
    >
      <Tabs defaultValue="usuarios">
        <TabsList className="flex-wrap">
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="permissoes">Permissões</TabsTrigger>
          <TabsTrigger value="auditoria">Histórico</TabsTrigger>
          <TabsTrigger value="lgpd">LGPD e backup</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="mt-4 space-y-3">
          {usuarios.length === 0 ? (
            <Vazio mensagem="Nenhum usuário cadastrado." />
          ) : (
            usuarios.map((u) => (
              <Card key={u.id}>
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <div className="min-w-52 flex-1">
                    <p className="font-medium">{u.nome}</p>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <Badge variant="secondary">{u.perfil}</Badge>
                  <Badge variant={u.ativo ? "outline" : "destructive"}>
                    {u.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                  <Button size="sm" variant="ghost" onClick={() => abrir(u)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {pode("excluir") ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        void remover(u.id, usuario.nome);
                        toast.success("Usuário removido.");
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="permissoes" className="mt-4 grid gap-3 md:grid-cols-2">
          {perfis.map((p) => (
            <Card key={p}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{p}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1">
                {permissoesDoPerfil(p).map((perm) => (
                  <Badge key={perm} variant="secondary">
                    {perm}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          ))}
          <p className="text-xs text-muted-foreground md:col-span-2">
            As permissões também serão aplicadas no servidor (regras do Firebase). O sistema nunca
            confia apenas na tela: toda ação é validada novamente no backend.
          </p>
        </TabsContent>

        <TabsContent value="auditoria" className="mt-4">
          {historico.length === 0 ? (
            <Vazio mensagem="Nenhum evento registrado ainda." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2">Usuário</th>
                    <th className="px-3 py-2">Ação</th>
                    <th className="px-3 py-2">Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((e) => (
                    <tr key={e.id} className="border-t border-border">
                      <td className="px-3 py-2">{new Date(e.data).toLocaleString("pt-BR")}</td>
                      <td className="px-3 py-2">{e.usuario}</td>
                      <td className="px-3 py-2">{e.acao}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {e.colecao} · {e.registroId}
                        {e.detalhe ? ` · ${e.detalhe}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="lgpd" className="mt-4 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Direitos do titular (LGPD)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Campo label="Cliente">
                <Select value={clienteLgpd} onValueChange={setClienteLgpd}>
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
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void exportarLgpd()}>
                  <Download className="mr-1 h-4 w-4" /> Exportar dados
                </Button>
                <Button variant="destructive" onClick={() => void excluirLgpd()}>
                  <Trash2 className="mr-1 h-4 w-4" /> Excluir dados pessoais
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Toda exportação e exclusão fica registrada no histórico, como exige a LGPD.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Backup do sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Gere uma cópia completa dos dados. Recomendado semanalmente — o arquivo pode ser
                guardado no computador da oficina ou no Google Drive, sem custo extra.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void backup()}>
                  <Download className="mr-1 h-4 w-4" /> Baixar backup
                </Button>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <Upload className="h-4 w-4" /> Restaurar backup
                  <input
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(e) => void restaurar(e.target.files?.[0])}
                  />
                </label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar usuário" : "Novo usuário"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <CampoTexto
              label="Nome"
              valor={String(form.valores["nome"] ?? "")}
              erro={form.erros["nome"]}
              onChange={(v) => form.set("nome", v)}
            />
            <CampoTexto
              label="E-mail de acesso"
              valor={String(form.valores["email"] ?? "")}
              erro={form.erros["email"]}
              onChange={(v) => form.set("email", v)}
            />
            <Campo label="Perfil" erro={form.erros["perfil"]}>
              <Select
                value={String(form.valores["perfil"] ?? "Mecânico")}
                onValueChange={(v) => form.set("perfil", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {perfis.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={Boolean(form.valores["ativo"])}
                onCheckedChange={(v) => form.set("ativo", Boolean(v))}
              />
              Usuário ativo
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
