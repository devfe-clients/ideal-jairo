import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  TrendingDown,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useColecao } from "@/lib/db";
import type { Agendamento, Cliente, Lancamento, OrdemServico, Peca, Veiculo } from "@/lib/schemas";
import { brl, dataBR, totaisOS } from "@/lib/calc";
import { Vazio } from "@/components/form-kit";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Oficina | Ideal Jairo" },
      {
        name: "description",
        content:
          "Painel da Oficina Ideal Jairo com ordens de serviço em andamento, agenda do dia e situação financeira.",
      },
      { property: "og:title", content: "Painel | Oficina Ideal Jairo" },
      {
        property: "og:description",
        content: "Visão geral da oficina: OS, agenda, financeiro e estoque.",
      },
    ],
  }),
  component: Painel,
});

function Indicador({
  titulo,
  valor,
  detalhe,
  icone: Icone,
  tom = "default",
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  icone: typeof Wrench;
  tom?: "default" | "sucesso" | "alerta" | "perigo";
}) {
  const cor =
    tom === "sucesso"
      ? "text-success"
      : tom === "alerta"
        ? "text-warning"
        : tom === "perigo"
          ? "text-destructive"
          : "text-primary";
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{titulo}</p>
          <p className={`mt-1 font-display text-2xl font-bold ${cor}`}>{valor}</p>
          {detalhe ? <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p> : null}
        </div>
        <Icone className={`h-5 w-5 shrink-0 ${cor}`} />
      </CardContent>
    </Card>
  );
}

function Painel() {
  const { dados: ordens } = useColecao<OrdemServico>("ordens");
  const { dados: agendamentos } = useColecao<Agendamento>("agendamentos");
  const { dados: lancamentos } = useColecao<Lancamento>("lancamentos");
  const { dados: pecas } = useColecao<Peca>("pecas");
  const { dados: clientes } = useColecao<Cliente>("clientes");
  const { dados: veiculos } = useColecao<Veiculo>("veiculos");

  const hoje = new Date().toISOString().slice(0, 10);
  const abertas = ordens.filter(
    (o) => o.tipo === "os" && o.status !== "Entregue/Fechado" && o.status !== "Finalizado",
  );
  const orcamentosPendentes = ordens.filter(
    (o) => o.tipo === "orcamento" && o.aprovacao === "Aguardando aprovação",
  );
  const agendaHoje = agendamentos.filter((a) => a.data === hoje && a.status !== "Cancelado");
  const aReceber = lancamentos
    .filter((l) => l.tipo === "receber" && !l.pagoEm)
    .reduce((s, l) => s + l.valor, 0);
  const aPagar = lancamentos
    .filter((l) => l.tipo === "pagar" && !l.pagoEm)
    .reduce((s, l) => s + l.valor, 0);
  const recebidoMes = lancamentos
    .filter((l) => l.tipo === "receber" && l.pagoEm?.slice(0, 7) === hoje.slice(0, 7))
    .reduce((s, l) => s + l.valor, 0);
  const estoqueBaixo = pecas.filter((p) => p.quantidade <= p.estoqueMinimo);

  const nomeCliente = (id: string) => clientes.find((c) => c.id === id)?.nome ?? "—";
  const placa = (id: string) => veiculos.find((v) => v.id === id)?.placa ?? "—";

  return (
    <AppLayout
      titulo="Painel da oficina"
      descricao="Resumo do dia — tudo que precisa de ação agora"
      acoes={
        <>
          <Button asChild variant="outline" size="sm">
            <Link to="/agendar">Link de agendamento</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/os">Nova OS</Link>
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador titulo="OS em aberto" valor={String(abertas.length)} icone={Wrench} detalhe={`${orcamentosPendentes.length} orçamento(s) aguardando aprovação`} />
        <Indicador titulo="Agendamentos hoje" valor={String(agendaHoje.length)} icone={CalendarClock} tom="alerta" detalhe="Confirme por WhatsApp" />
        <Indicador titulo="A receber" valor={brl(aReceber)} icone={TrendingUp} tom="sucesso" detalhe={`Recebido no mês: ${brl(recebidoMes)}`} />
        <Indicador titulo="A pagar" valor={brl(aPagar)} icone={TrendingDown} tom="perigo" detalhe="Contas em aberto" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Ordens de serviço em andamento</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            {abertas.length === 0 ? (
              <Vazio mensagem="Nenhuma OS em aberto no momento." />
            ) : (
              abertas.map((os) => (
                <Link
                  key={os.id}
                  to="/os/$id"
                  params={{ id: os.id }}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 transition-colors hover:border-primary"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {os.numero} — {nomeCliente(os.clienteId)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {placa(os.veiculoId)} · emissão {dataBR(os.emissao)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{os.status}</Badge>
                    <span className="font-display text-sm font-bold text-primary">
                      {brl(totaisOS(os).total)}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Agenda de hoje</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {agendaHoje.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem agendamentos para hoje.</p>
              ) : (
                agendaHoje.map((a) => (
                  <div key={a.id} className="rounded-md border border-border p-2 text-sm">
                    <p className="font-semibold">
                      {a.hora} · {a.nome}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.placa} · {a.servico}
                    </p>
                  </div>
                ))
              )}
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to="/agenda">Abrir agenda</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Estoque baixo</CardTitle>
              <AlertTriangle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent className="space-y-2">
              {estoqueBaixo.length === 0 ? (
                <p className="text-sm text-muted-foreground">Estoque em dia.</p>
              ) : (
                estoqueBaixo.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{p.nome}</span>
                    <Badge variant="outline" className="text-warning">
                      {p.quantidade}/{p.estoqueMinimo}
                    </Badge>
                  </div>
                ))
              )}
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to="/estoque">Ver estoque</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
