import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock, LogOut, Plus, X } from "lucide-react";
import { toast } from "sonner";
const logo = { url: "/logo-ideal-jairo.jpg" };
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Campo, CampoArea, CampoTexto, useFormularioZod } from "@/components/form-kit";
import { agendamentoSchema, type Agendamento, type Config, type ServicoBase } from "@/lib/schemas";
import { useColecao, novoId } from "@/lib/db";
import { dataBR, formatarDoc, formatarPlaca, formatarTelefone } from "@/lib/calc";
import { EMPRESA } from "@/lib/empresa";
import { ClienteAuthProvider, useClienteAuth } from "@/lib/clienteAuth";

export const Route = createFileRoute("/agendar")({
  head: () => ({
    meta: [
      { title: "Agendar serviço | Oficina Ideal Jairo" },
      { name: "description", content: "Agende online o serviço do seu carro na Oficina Ideal Jairo em Praia Grande/SP." },
      { property: "og:title", content: "Agendar serviço | Oficina Ideal Jairo" },
      { property: "og:description", content: "Agendamento online rápido para mecânica automotiva em Praia Grande/SP." },
    ],
  }),
  component: AgendarWrapper,
});

function AgendarWrapper() {
  return (
    <ClienteAuthProvider>
      <AgendarPublico />
    </ClienteAuthProvider>
  );
}

function horariosDoDia(config: Config | undefined, data: string, ocupados: string[]) {
  if (!config || !data) return [];
  const diaSemana = new Date(`${data}T12:00:00`).getDay();
  if (!config.diasAtendimento.includes(diaSemana)) return [];
  if (config.diasBloqueados.includes(data)) return [];

  const exc = (config.excecoesData ?? []).find((e) => e.data === data);
  if (exc?.fechado) return [];

  const limite = exc?.limitePorHorario ?? config.limitePorHorario;
  const bloqueados = exc?.horariosBlockeados ?? [];

  const [hi, mi] = config.horaInicio.split(":").map(Number);
  const [hf, mf] = config.horaFim.split(":").map(Number);
  const inicio = (hi ?? 8) * 60 + (mi ?? 0);
  const fim = (hf ?? 18) * 60 + (mf ?? 0);
  const slots: string[] = [];
  for (let m = inicio; m < fim; m += config.intervaloMinutos) {
    const hora = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    if (bloqueados.includes(hora)) continue;
    const usados = ocupados.filter((o) => o === hora).length;
    if (usados < limite) slots.push(hora);
  }
  return slots;
}

const CORES_STATUS: Record<string, string> = {
  Pendente: "bg-warning/15 text-warning border-warning/30",
  Confirmado: "bg-success/15 text-success border-success/30",
  Cancelado: "bg-destructive/15 text-destructive border-destructive/30",
  Convertido: "bg-primary/15 text-primary border-primary/30",
};

function AgendarPublico() {
  const { cliente, carregando, entrarComGoogle, sair } = useClienteAuth();
  const { dados: agendamentos, salvar } = useColecao<Agendamento>("agendamentos");
  const { dados: configs } = useColecao<Config & { id: string }>("config");
  const { dados: servicos } = useColecao<ServicoBase>("servicos");
  const [novoAgendamento, setNovoAgendamento] = useState(false);
  const [enviado, setEnviado] = useState<Agendamento | null>(null);

  const vazio = {
    nome: cliente?.nome ?? "",
    cpfCnpj: "",
    telefone: "",
    email: cliente?.email ?? "",
    endereco: "",
    placa: "",
    marca: "",
    modelo: "",
    ano: new Date().getFullYear(),
    km: 0,
    servico: "",
    descricao: "",
    data: "",
    hora: "",
    status: "Pendente" as const,
    consentimentoLgpd: false,
  };

  const form = useFormularioZod(agendamentoSchema, vazio);
  const config = configs[0];
  const data = String(form.valores["data"] ?? "");

  // Agendamentos do cliente logado
  const meusAgendamentos = useMemo(() => {
    if (!cliente) return [];
    return agendamentos
      .filter((a) => a.email === cliente.email || (a as unknown as { uid?: string }).uid === cliente.uid)
      .sort((a, b) => `${b.data}${b.hora}`.localeCompare(`${a.data}${a.hora}`));
  }, [agendamentos, cliente]);

  const horarios = useMemo(
    () => horariosDoDia(
      config, data,
      agendamentos.filter((a) => a.data === data && a.status !== "Cancelado").map((a) => a.hora),
    ),
    [config, data, agendamentos],
  );

  async function enviar() {
    const dados = form.validar();
    if (!dados) { toast.error("Confira os campos destacados."); return; }
    if (!horarios.includes(dados.hora)) {
      form.setErros((e) => ({ ...e, hora: "Horário indisponível, escolha outro." }));
      return;
    }
    const registro = {
      ...dados,
      id: novoId(),
      uid: cliente?.uid ?? "",
      criadoEm: new Date().toISOString(),
    } as Agendamento;
    await salvar(registro, "agendamento-online");
    setEnviado(registro);
    setNovoAgendamento(false);
  }

  async function cancelar(a: Agendamento) {
    if (a.status === "Cancelado" || a.status === "Convertido") return;
    await salvar({ ...a, status: "Cancelado" }, "cliente-online");
    toast.success("Agendamento cancelado.");
  }

  // Tela de carregando
  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  // Header comum
  const Header = () => (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3">
          <img src={logo.url} alt="Ideal Jairo" className="h-10 w-10 rounded-md object-cover" />
          <div>
            <p className="font-display text-base font-bold">Oficina Ideal Jairo</p>
            <p className="text-xs text-muted-foreground">{EMPRESA.cidade}</p>
          </div>
        </div>
        {cliente ? (
          <div className="flex items-center gap-3">
            {cliente.foto ? (
              <img src={cliente.foto} alt={cliente.nome} className="h-8 w-8 rounded-full object-cover" />
            ) : null}
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium">{cliente.nome.split(" ")[0]}</p>
              <p className="text-xs text-muted-foreground">{cliente.email}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => void sair()} className="text-muted-foreground">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </header>
  );

  // Tela de sucesso após agendar
  if (enviado) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center p-6">
          <Card className="w-full max-w-md text-center">
            <CardContent className="space-y-4 p-8">
              <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
              <h1 className="text-xl font-bold">Agendamento enviado!</h1>
              <p className="text-sm text-muted-foreground">
                {enviado.nome.split(" ")[0]}, recebemos seu pedido para{" "}
                <strong>{new Date(`${enviado.data}T12:00:00`).toLocaleDateString("pt-BR")}</strong>{" "}
                às <strong>{enviado.hora}</strong>. A oficina confirmará por WhatsApp no número{" "}
                {formatarTelefone(enviado.telefone)}.
              </p>
              <Button onClick={() => setEnviado(null)} className="w-full">
                Ver meus agendamentos
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Tela de login (não logado)
  if (!cliente) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center p-6">
          <Card className="w-full max-w-sm">
            <CardContent className="space-y-6 p-8 text-center">
              <div>
                <CalendarDays className="mx-auto h-10 w-10 text-primary mb-3" />
                <h1 className="text-xl font-bold">Agende seu serviço</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Entre com sua conta Google para agendar e acompanhar seus atendimentos.
                </p>
              </div>
              <Button className="w-full gap-2" onClick={() => void entrarComGoogle()}>
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Entrar com Google
              </Button>
              <p className="text-xs text-muted-foreground">
                Seus dados são usados apenas para agendamento e atendimento, conforme a LGPD.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Formulário de novo agendamento
  const FormAgendamento = () => (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Novo agendamento</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setNovoAgendamento(false)}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <CampoTexto label="Nome completo" className="sm:col-span-2"
          valor={String(form.valores["nome"] ?? "")} erro={form.erros["nome"]}
          onChange={(v) => form.set("nome", v)} />
        <CampoTexto label="CPF / CNPJ (opcional)"
          valor={formatarDoc(String(form.valores["cpfCnpj"] ?? ""))} erro={form.erros["cpfCnpj"]}
          onChange={(v) => form.set("cpfCnpj", v)} />
        <CampoTexto label="Telefone / WhatsApp"
          valor={formatarTelefone(String(form.valores["telefone"] ?? ""))} erro={form.erros["telefone"]}
          onChange={(v) => form.set("telefone", v)} />
        <CampoTexto label="E-mail (opcional)"
          valor={String(form.valores["email"] ?? "")} erro={form.erros["email"]}
          onChange={(v) => form.set("email", v)} />
        <CampoTexto label="Endereço"
          valor={String(form.valores["endereco"] ?? "")} erro={form.erros["endereco"]}
          onChange={(v) => form.set("endereco", v)} />
        <CampoTexto label="Placa"
          valor={formatarPlaca(String(form.valores["placa"] ?? ""))} erro={form.erros["placa"]}
          onChange={(v) => form.set("placa", formatarPlaca(v))} />
        <CampoTexto label="Marca"
          valor={String(form.valores["marca"] ?? "")} erro={form.erros["marca"]}
          onChange={(v) => form.set("marca", v)} />
        <CampoTexto label="Modelo"
          valor={String(form.valores["modelo"] ?? "")} erro={form.erros["modelo"]}
          onChange={(v) => form.set("modelo", v)} />
        <CampoTexto label="Ano" type="number"
          valor={String(form.valores["ano"] ?? "")} erro={form.erros["ano"]}
          onChange={(v) => form.set("ano", v)} />
        <CampoTexto label="Quilometragem" type="number"
          valor={String(form.valores["km"] ?? "")} erro={form.erros["km"]}
          onChange={(v) => form.set("km", v)} />
        <Campo label="Serviço desejado" erro={form.erros["servico"]}>
          <Select value={String(form.valores["servico"] ?? "")} onValueChange={(v) => form.set("servico", v)}>
            <SelectTrigger><SelectValue placeholder="Escolha o serviço" /></SelectTrigger>
            <SelectContent>
              {(() => {
                const excData = data
                  ? (config?.excecoesData ?? []).find((e) => e.data === data)
                  : undefined;
                return servicos
                  .filter((s) => s.disponivelParaAgendamento !== false)
                  .filter((s) =>
                    !excData?.servicosDisponiveis ||
                    excData.servicosDisponiveis.includes(s.nome)
                  )
                  .map((s) => (
                    <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>
                  ));
              })()}
              <SelectItem value="Outro / não sei informar">Outro / não sei informar</SelectItem>
            </SelectContent>
          </Select>
        </Campo>
        <CampoTexto label="Data" type="date" valor={data} erro={form.erros["data"]}
          onChange={(v) => { form.set("data", v); form.set("hora", ""); }} />
        <Campo label="Horário disponível" erro={form.erros["hora"]} className="sm:col-span-2"
          dica={data && horarios.length === 0 ? "Sem horários nesta data. Escolha outro dia." : "Só aparecem horários realmente livres."}>
          <div className="flex flex-wrap gap-2">
            {horarios.map((h) => (
              <Button key={h} type="button" size="sm"
                variant={form.valores["hora"] === h ? "default" : "outline"}
                onClick={() => form.set("hora", h)}>{h}</Button>
            ))}
          </div>
        </Campo>
        <CampoArea label="Descrição do problema" className="sm:col-span-2"
          valor={String(form.valores["descricao"] ?? "")} erro={form.erros["descricao"]}
          onChange={(v) => form.set("descricao", v)} />
        <div className="sm:col-span-2">
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={Boolean(form.valores["consentimentoLgpd"])}
              onCheckedChange={(v) => form.set("consentimentoLgpd", Boolean(v))} />
            <span>Autorizo o uso dos meus dados para atendimento e contato, conforme a LGPD.</span>
          </label>
          {form.erros["consentimentoLgpd"] ? (
            <p className="mt-1 text-[11px] font-medium text-destructive">{form.erros["consentimentoLgpd"]}</p>
          ) : null}
        </div>
        <Button className="sm:col-span-2" onClick={() => void enviar()}>Confirmar agendamento</Button>
      </CardContent>
    </Card>
  );

  // Tela principal — Meus Agendamentos
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold">
              Olá, {cliente.nome.split(" ")[0]}!
            </h1>
            <p className="text-sm text-muted-foreground">Seus agendamentos na Oficina Ideal Jairo</p>
          </div>
          {!novoAgendamento ? (
            <Button size="sm" onClick={() => {
              form.reset({ ...vazio, nome: cliente.nome, email: cliente.email });
              setNovoAgendamento(true);
            }}>
              <Plus className="mr-1 h-4 w-4" /> Novo agendamento
            </Button>
          ) : null}
        </div>

        {novoAgendamento ? <FormAgendamento /> : null}

        {meusAgendamentos.length === 0 && !novoAgendamento ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <CalendarDays className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Nenhum agendamento ainda</p>
              <p className="text-sm text-muted-foreground">Clique em "Novo agendamento" para marcar seu horário.</p>
              <Button onClick={() => {
                form.reset({ ...vazio, nome: cliente.nome, email: cliente.email });
                setNovoAgendamento(true);
              }}>
                <Plus className="mr-1 h-4 w-4" /> Agendar agora
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {meusAgendamentos.map((a) => {
              const passado = a.data < new Date().toISOString().slice(0, 10);
              return (
                <Card key={a.id} className={passado ? "opacity-60" : ""}>
                  <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-center">
                        <Clock className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{a.servico}</p>
                        <p className="text-sm text-muted-foreground">
                          {dataBR(a.data)} às {a.hora}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.placa} · {a.marca} {a.modelo} {a.ano}
                        </p>
                        {a.descricao ? (
                          <p className="mt-1 text-xs text-muted-foreground">{a.descricao}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge className={CORES_STATUS[a.status] ?? ""} variant="outline">
                        {a.status}
                      </Badge>
                      {!passado && a.status !== "Cancelado" && a.status !== "Convertido" ? (
                        <Button size="sm" variant="ghost" className="text-destructive text-xs"
                          onClick={() => void cancelar(a)}>
                          Cancelar
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
      <footer className="border-t border-border mt-6">
        <div className="mx-auto max-w-3xl px-4 py-5 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Oficina Ideal Jairo</span>
          <div className="flex gap-4">
            <Link to="/privacidade" className="hover:text-foreground transition-colors">Privacidade</Link>
            <Link to="/termos" className="hover:text-foreground transition-colors">Termos de uso</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}