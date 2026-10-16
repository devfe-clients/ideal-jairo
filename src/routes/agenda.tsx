import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, Check, MessageCircle, Plus, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Campo, CampoArea, CampoTexto, Vazio, useFormularioZod } from "@/components/form-kit";
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
import { dadosDoAgendamento, novaOrdem } from "@/lib/os-helpers";
import { dataBR, formatarDoc, formatarPlaca, formatarTelefone, linkWhatsApp } from "@/lib/calc";
import { useAuth } from "@/lib/auth";
import {
  agendamentoSchema,
  type Agendamento,
  type Cliente,
  type Config,
  type OrdemServico,
  type ServicoBase,
  type Veiculo,
} from "@/lib/schemas";

export const Route = createFileRoute("/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda da oficina | Ideal Jairo" },
      {
        name: "description",
        content:
          "Agenda diária da Oficina Ideal Jairo: confirme agendamentos online e transforme em ordem de serviço em um clique.",
      },
      { property: "og:title", content: "Agenda da oficina | Ideal Jairo" },
      {
        property: "og:description",
        content: "Controle os horários e converta agendamentos em OS automaticamente.",
      },
    ],
  }),
  component: AgendaPage,
});

const CORES: Record<string, string> = {
  Pendente: "bg-warning/15 text-warning",
  Confirmado: "bg-success/15 text-success",
  Cancelado: "bg-destructive/15 text-destructive",
  Convertido: "bg-primary/15 text-primary",
};

function AgendaPage() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { dados: agendamentos, salvar } = useColecao<Agendamento>("agendamentos");
  const { dados: clientes, salvar: salvarCliente } = useColecao<Cliente>("clientes");
  const { dados: veiculos, salvar: salvarVeiculo } = useColecao<Veiculo>("veiculos");
  const { dados: ordens, salvar: salvarOS } = useColecao<OrdemServico>("ordens");
  const [dia, setDia] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("Todos");
  const [modo, setModo] = useState<"dia" | "proximos">("dia");

  const [modalAberto, setModalAberto] = useState(false);
  const [clienteRef, setClienteRef] = useState<Cliente | null>(null);
  const { dados: servicos } = useColecao<ServicoBase>("servicos");
  const { dados: configs } = useColecao<Config & { id: string }>("config");

  const vaziomanual = {
    nome: "", cpfCnpj: "", telefone: "", email: "", endereco: "",
    placa: "", marca: "", modelo: "",
    ano: new Date().getFullYear(), km: 0,
    servico: "", descricao: "",
    data: dia, hora: "",
    status: "Confirmado" as const,
    consentimentoLgpd: true,
  };
  const formManual = useFormularioZod(agendamentoSchema, vaziomanual);

  const config = configs[0];

  function horariosDisponiveis(dataSel: string) {
    if (!config || !dataSel) return [];
    const diaSemana = new Date(`${dataSel}T12:00:00`).getDay();
    if (!config.diasAtendimento.includes(diaSemana)) return [];
    if (config.diasBloqueados.includes(dataSel)) return [];
    const exc = (config.excecoesData ?? []).find((e) => e.data === dataSel);
    if (exc?.fechado) return [];
    const bloqueados = exc?.horariosBlockeados ?? [];
    const [hi, mi] = config.horaInicio.split(":").map(Number);
    const [hf, mf] = config.horaFim.split(":").map(Number);
    const inicio = (hi ?? 8) * 60 + (mi ?? 0);
    const fim = (hf ?? 18) * 60 + (mf ?? 0);
    const slots: string[] = [];
    for (let m = inicio; m < fim; m += config.intervaloMinutos) {
      const hora = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      if (!bloqueados.includes(hora)) slots.push(hora);
    }
    return slots;
  }

  async function salvarManual() {
    const dados = formManual.validar();
    if (!dados) { toast.error("Confira os campos destacados."); return; }
    if (!clienteRef) {
      const jaExiste = clientes.find(
        (c) => c.telefone.replace(/\D/g, "") === dados.telefone.replace(/\D/g, ""),
      );
      if (!jaExiste) {
        await salvarCliente(
          {
            id: novoId(),
            nome: dados.nome,
            telefone: dados.telefone,
            email: dados.email ?? "",
            cpfCnpj: dados.cpfCnpj ?? "",
            numero: "",
            bairro: "",
            cidade: "",
            uf: "SP",
            cep: "",
            endereco: dados.endereco ?? "",
            observacoes: "Cadastro criado via agendamento manual.",
            consentimentoLgpd: dados.consentimentoLgpd,
            criadoEm: new Date().toISOString(),
          } as Cliente,
          usuario?.uid ?? "sistema",
        );
      }
    }
    const registro = {
      ...dados,
      id: novoId(),
      criadoEm: new Date().toISOString(),
    } as Agendamento;
    await salvar(registro, usuario?.uid ?? "sistema");
    toast.success("Agendamento criado.");
    setModalAberto(false);
    setClienteRef(null);
    setDia(registro.data);
  }

  const doDia = useMemo(
    () =>
      modo === "proximos"
        ? agendamentos
            .filter((a) => a.data >= new Date().toISOString().slice(0, 10))
            .filter((a) => status === "Todos" || a.status === status)
            .sort((a, b) => a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora))
        : agendamentos
            .filter((a) => a.data === dia)
            .filter((a) => status === "Todos" || a.status === status)
            .sort((a, b) => a.hora.localeCompare(b.hora)),
    [agendamentos, dia, status, modo],
  );

  async function mudarStatus(a: Agendamento, novo: Agendamento["status"]) {
    await salvar({ ...a, status: novo }, usuario?.uid ?? "sistema");
    toast.success(`Agendamento ${novo.toLowerCase()}.`);
  }

  async function converter(a: Agendamento) {
    let { cliente, veiculo } = dadosDoAgendamento(a, clientes, veiculos);

    if (!cliente) {
      cliente = {
        id: novoId(),
        nome: a.nome,
        cpfCnpj: a.cpfCnpj,
        telefone: a.telefone,
        email: a.email ?? "",
        endereco: a.endereco ?? "",
        numero: "",
        bairro: "",
        cidade: "",
        uf: "SP",
        cep: "",
        observacoes: `Cadastro criado a partir do agendamento online de ${dataBR(a.data)}.`,
        consentimentoLgpd: a.consentimentoLgpd,
        criadoEm: new Date().toISOString(),
      } as Cliente;
      await salvarCliente(cliente, usuario?.uid ?? "sistema");
    }

    if (!veiculo) {
      veiculo = {
        id: novoId(),
        clienteId: cliente.id,
        placa: a.placa,
        marca: a.marca,
        modelo: a.modelo,
        ano: a.ano,
        cor: "",
        combustivel: "Flex",
        motor: "",
        chassi: "",
        km: a.km,
        observacoes: "",
        criadoEm: new Date().toISOString(),
      } as Veiculo;
      await salvarVeiculo(veiculo, usuario?.uid ?? "sistema");
    }

    const os = novaOrdem(ordens, "os", cliente.id, veiculo.id, a.km, usuario?.uid ?? "sistema");
    os.reclamacao = `${a.servico}${a.descricao ? ` — ${a.descricao}` : ""}`;
    os.status = "Aguardando atendimento";
    await salvarOS(os, usuario?.uid ?? "sistema");
    await salvar({ ...a, status: "Convertido" }, usuario?.uid ?? "sistema");
    toast.success(`OS ${os.numero} criada a partir do agendamento.`);
    void navigate({ to: "/os/$id", params: { id: os.id } });
  }

  return (
    <AppLayout
      titulo="Agenda da oficina"
      descricao="Horários solicitados pelos clientes no agendamento online."
      acoes={
        <>
          {modo === "dia" ? (
            <Input
              type="date"
              className="w-40"
              value={dia}
              onChange={(e) => setDia(e.target.value)}
            />
          ) : null}
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {["Todos", "Pendente", "Confirmado", "Cancelado", "Convertido"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <Button
            size="sm"
            variant={modo === "proximos" ? "default" : "outline"}
            onClick={() => setModo((m) => (m === "dia" ? "proximos" : "dia"))}
          >
            {modo === "proximos" ? "← Dia" : "Próximos →"}
          </Button>
          <Button size="sm" onClick={() => {
            formManual.reset({ ...vaziomanual, data: dia });
            setClienteRef(null);
            setModalAberto(true);
          }}>
            <Plus className="mr-1 h-4 w-4" /> Novo agendamento
          </Button>
        </>
      }
    >
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarDays className="h-4 w-4" />
        {modo === "proximos"
          ? `${doDia.length} agendamento(s) a partir de hoje`
          : `${doDia.length} agendamento(s) em ${dataBR(dia)}`}
      </div>

      {doDia.length === 0 ? (
        <Vazio mensagem={modo === "proximos" ? "Nenhum agendamento futuro." : "Nenhum agendamento para este dia e filtro."} />
      ) : (
        <div className="space-y-3">
          {doDia.map((a, idx) => {
            const mostrarData = modo === "proximos" && (idx === 0 || doDia[idx - 1]?.data !== a.data);
            return (
              <div key={a.id}>
                {mostrarData ? (
                  <p className={`text-sm font-semibold text-foreground pb-2 mb-2 border-b border-border${idx > 0 ? " mt-4" : ""}`}>
                    {dataBR(a.data)}
                  </p>
                ) : null}
                <Card>
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <div className="w-16 shrink-0 text-center">
                  <p className="font-display text-xl font-bold text-primary">{a.hora}</p>
                </div>
                <div className="min-w-52 flex-1">
                  <p className="font-medium">{a.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {a.marca} {a.modelo} {a.ano} · {a.placa} · {formatarTelefone(a.telefone)}
                  </p>
                  <p className="text-sm">{a.servico}</p>
                  {a.descricao ? (
                    <p className="text-xs text-muted-foreground">{a.descricao}</p>
                  ) : null}
                </div>
                <Badge className={CORES[a.status] ?? ""} variant="secondary">
                  {a.status}
                </Badge>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <a
                      href={linkWhatsApp(
                        a.telefone,
                        `Olá ${a.nome.split(" ")[0]}! Confirmando seu horário na Oficina Ideal Jairo em ${dataBR(a.data)} às ${a.hora}.`,
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  </Button>
                  {a.status === "Pendente" ? (
                    <Button size="sm" variant="outline" onClick={() => void mudarStatus(a, "Confirmado")}>
                      <Check className="mr-1 h-4 w-4" /> Confirmar
                    </Button>
                  ) : null}
                  {a.status !== "Convertido" && a.status !== "Cancelado" ? (
                    <>
                      <Button size="sm" onClick={() => void converter(a)}>
                        <Wrench className="mr-1 h-4 w-4" /> Abrir OS
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => void mudarStatus(a, "Cancelado")}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo agendamento manual</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Nome completo" className="sm:col-span-2" erro={formManual.erros["nome"]}>
              <datalist id="clientes-agenda">
                {clientes
                  .slice()
                  .sort((a, b) => a.nome.localeCompare(b.nome))
                  .map((c) => <option key={c.id} value={c.nome} />)}
              </datalist>
              <input
                list="clientes-agenda"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
                placeholder="Nome do cliente..."
                value={String(formManual.valores["nome"] ?? "")}
                onChange={(e) => {
                  formManual.set("nome", e.target.value);
                  const encontrado = clientes.find((c) => c.nome === e.target.value);
                  if (encontrado) {
                    setClienteRef(encontrado);
                    formManual.set("telefone", encontrado.telefone);
                    if (encontrado.email) formManual.set("email", encontrado.email);
                    const veiculo = veiculos
                      .filter((v) => v.clienteId === encontrado.id)
                      .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())[0];
                    if (veiculo) {
                      formManual.set("placa", veiculo.placa);
                      formManual.set("marca", veiculo.marca);
                      formManual.set("modelo", veiculo.modelo);
                      formManual.set("ano", String(veiculo.ano));
                    }
                  } else {
                    setClienteRef(null);
                  }
                }}
              />
            </Campo>
            <CampoTexto label="CPF / CNPJ (opcional)"
              valor={formatarDoc(String(formManual.valores["cpfCnpj"] ?? ""))} erro={formManual.erros["cpfCnpj"]}
              onChange={(v) => formManual.set("cpfCnpj", v)} />
            <CampoTexto label="Telefone / WhatsApp"
              valor={formatarTelefone(String(formManual.valores["telefone"] ?? ""))} erro={formManual.erros["telefone"]}
              onChange={(v) => formManual.set("telefone", v)} />
            <CampoTexto label="E-mail (opcional)"
              valor={String(formManual.valores["email"] ?? "")} erro={formManual.erros["email"]}
              onChange={(v) => formManual.set("email", v)} />
            <CampoTexto label="Placa"
              valor={formatarPlaca(String(formManual.valores["placa"] ?? ""))} erro={formManual.erros["placa"]}
              onChange={(v) => formManual.set("placa", formatarPlaca(v))} />
            <CampoTexto label="Marca"
              valor={String(formManual.valores["marca"] ?? "")} erro={formManual.erros["marca"]}
              onChange={(v) => formManual.set("marca", v)} />
            <CampoTexto label="Modelo"
              valor={String(formManual.valores["modelo"] ?? "")} erro={formManual.erros["modelo"]}
              onChange={(v) => formManual.set("modelo", v)} />
            <CampoTexto label="Ano" type="number"
              valor={String(formManual.valores["ano"] ?? "")} erro={formManual.erros["ano"]}
              onChange={(v) => formManual.set("ano", v)} />
            <CampoTexto label="Quilometragem" type="number"
              valor={String(formManual.valores["km"] ?? "")} erro={formManual.erros["km"]}
              onChange={(v) => formManual.set("km", v)} />
            <Campo label="Serviço" erro={formManual.erros["servico"]}>
              <Select value={String(formManual.valores["servico"] ?? "")} onValueChange={(v) => formManual.set("servico", v)}>
                <SelectTrigger><SelectValue placeholder="Escolha o serviço" /></SelectTrigger>
                <SelectContent>
                  {servicos
                    .filter((s) => s.disponivelParaAgendamento !== false)
                    .map((s) => <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>)}
                  <SelectItem value="Outro / não sei informar">Outro / não sei informar</SelectItem>
                  {servicos
                    .filter((s) => s.disponivelParaAgendamento === false)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.nome} disabled>
                        {s.nome} — indisponível
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="Status" erro={formManual.erros["status"]}>
              <Select value={String(formManual.valores["status"] ?? "Confirmado")} onValueChange={(v) => formManual.set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Pendente", "Confirmado", "Cancelado", "Convertido"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <CampoTexto label="Data" type="date"
              valor={String(formManual.valores["data"] ?? "")} erro={formManual.erros["data"]}
              onChange={(v) => { formManual.set("data", v); formManual.set("hora", ""); }} />
            <Campo label="Horário" erro={formManual.erros["hora"]}>
              <div className="flex flex-wrap gap-2">
                {horariosDisponiveis(String(formManual.valores["data"] ?? "")).map((h) => (
                  <Button key={h} type="button" size="sm"
                    variant={formManual.valores["hora"] === h ? "default" : "outline"}
                    onClick={() => formManual.set("hora", h)}>{h}</Button>
                ))}
              </div>
            </Campo>
            <CampoArea label="Observações" className="sm:col-span-2"
              valor={String(formManual.valores["descricao"] ?? "")} erro={formManual.erros["descricao"]}
              onChange={(v) => formManual.set("descricao", v)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={() => void salvarManual()}>Salvar agendamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
