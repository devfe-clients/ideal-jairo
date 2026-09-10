import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, Check, MessageCircle, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Vazio } from "@/components/form-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useColecao, novoId } from "@/lib/db";
import { dadosDoAgendamento, novaOrdem } from "@/lib/os-helpers";
import { dataBR, formatarTelefone, linkWhatsApp } from "@/lib/calc";
import { useAuth } from "@/lib/auth";
import type { Agendamento, Cliente, OrdemServico, Veiculo } from "@/lib/schemas";

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

  const doDia = useMemo(
    () =>
      agendamentos
        .filter((a) => a.data === dia)
        .filter((a) => status === "Todos" || a.status === status)
        .sort((a, b) => a.hora.localeCompare(b.hora)),
    [agendamentos, dia, status],
  );

  async function mudarStatus(a: Agendamento, novo: Agendamento["status"]) {
    await salvar({ ...a, status: novo }, usuario.nome);
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
      await salvarCliente(cliente, usuario.nome);
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
      await salvarVeiculo(veiculo, usuario.nome);
    }

    const os = novaOrdem(ordens, "os", cliente.id, veiculo.id, a.km, usuario.nome);
    os.reclamacao = `${a.servico}${a.descricao ? ` — ${a.descricao}` : ""}`;
    os.status = "Aguardando atendimento";
    await salvarOS(os, usuario.nome);
    await salvar({ ...a, status: "Convertido" }, usuario.nome);
    toast.success(`OS ${os.numero} criada a partir do agendamento.`);
    void navigate({ to: "/os/$id", params: { id: os.id } });
  }

  return (
    <AppLayout
      titulo="Agenda da oficina"
      descricao="Horários solicitados pelos clientes no agendamento online."
      acoes={
        <>
          <Input
            type="date"
            className="w-40"
            value={dia}
            onChange={(e) => setDia(e.target.value)}
          />
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {["Todos", "Pendente", "Confirmado", "Cancelado", "Convertido"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </>
      }
    >
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarDays className="h-4 w-4" />
        {doDia.length} agendamento(s) em {dataBR(dia)}
      </div>

      {doDia.length === 0 ? (
        <Vazio mensagem="Nenhum agendamento para este dia e filtro." />
      ) : (
        <div className="space-y-3">
          {doDia.map((a) => (
            <Card key={a.id}>
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
          ))}
        </div>
      )}
    </AppLayout>
  );
}
