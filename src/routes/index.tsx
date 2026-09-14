import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  TrendingDown,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useColecao } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import type { Agendamento, Cliente, Lancamento, OrdemServico, Peca, Veiculo } from "@/lib/schemas";
import { brl, dataBR, totaisOS } from "@/lib/calc";
import { Vazio } from "@/components/form-kit";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel | Oficina Ideal Jairo" },
      { name: "description", content: "Painel da Oficina Ideal Jairo com ordens de serviço em andamento, agenda do dia e situação financeira." },
      { property: "og:title", content: "Painel | Oficina Ideal Jairo" },
      { property: "og:description", content: "Visão geral da oficina: OS, agenda, financeiro e estoque." },
    ],
  }),
  component: Painel,
});

function Indicador({
  titulo, valor, detalhe, icone: Icone, tom = "default", to,
}: {
  titulo: string; valor: string; detalhe?: string;
  icone: typeof Wrench; tom?: "default" | "sucesso" | "alerta" | "perigo";
  to?: string;
}) {
  const cor = tom === "sucesso" ? "text-success" : tom === "alerta" ? "text-warning" : tom === "perigo" ? "text-destructive" : "text-primary";
  const card = (
    <Card className={to ? "cursor-pointer transition-colors hover:border-primary" : ""}>
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
  if (to) return <Link to={to}>{card}</Link>;
  return card;
}

function Painel() {
  const { pode } = useAuth();
  const { dados: ordens } = useColecao<OrdemServico>("ordens");
  const { dados: agendamentos } = useColecao<Agendamento>("agendamentos");
  const { dados: lancamentos } = useColecao<Lancamento>("lancamentos");
  const { dados: pecas } = useColecao<Peca>("pecas");
  const { dados: clientes } = useColecao<Cliente>("clientes");
  const { dados: veiculos } = useColecao<Veiculo>("veiculos");

  const hoje = new Date().toISOString().slice(0, 10);
  const mesAtual = hoje.slice(0, 7);

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
    .filter((l) => l.tipo === "receber" && l.pagoEm?.slice(0, 7) === mesAtual)
    .reduce((s, l) => s + l.valor, 0);

  const estoqueBaixo = pecas.filter((p) => p.quantidade <= p.estoqueMinimo);

  // Lançamentos a vencer nos próximos 7 dias
  const proximosSete = useMemo(() => {
    const limite = new Date();
    limite.setDate(limite.getDate() + 7);
    const limiteStr = limite.toISOString().slice(0, 10);
    return lancamentos
      .filter((l) => !l.pagoEm && l.vencimento >= hoje && l.vencimento <= limiteStr)
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
      .slice(0, 5);
  }, [lancamentos, hoje]);

  // Vencidos não pagos
  const vencidos = lancamentos.filter((l) => !l.pagoEm && l.vencimento < hoje);

  // Gráfico: faturamento dos últimos 6 meses
  const dadosGrafico = useMemo(() => {
    const meses: { mes: string; recebido: number; aReceber: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const chave = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      const recebido = lancamentos
        .filter((l) => l.tipo === "receber" && l.pagoEm?.slice(0, 7) === chave)
        .reduce((s, l) => s + l.valor, 0);
      const pendente = lancamentos
        .filter((l) => l.tipo === "receber" && !l.pagoEm && l.vencimento?.slice(0, 7) === chave)
        .reduce((s, l) => s + l.valor, 0);
      meses.push({ mes: label, recebido, aReceber: pendente });
    }
    return meses;
  }, [lancamentos]);

  const nomeCliente = (id: string) => clientes.find((c) => c.id === id)?.nome ?? "—";
  const placaVeiculo = (id: string) => veiculos.find((v) => v.id === id)?.placa ?? "—";

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
      {/* Indicadores principais */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador titulo="OS em aberto" valor={String(abertas.length)} icone={Wrench}
          detalhe={`${orcamentosPendentes.length} orçamento(s) aguardando aprovação`} to="/os" />
        <Indicador titulo="Agendamentos hoje" valor={String(agendaHoje.length)} icone={CalendarClock}
          tom="alerta" detalhe="Confirme por WhatsApp" to="/agenda" />
        <Indicador titulo="A receber" valor={brl(aReceber)} icone={TrendingUp}
          tom="sucesso" detalhe={`Recebido no mês: ${brl(recebidoMes)}`} to="/financeiro" />
        <Indicador titulo="A pagar" valor={brl(aPagar)} icone={TrendingDown}
          tom="perigo" detalhe={vencidos.length > 0 ? `${vencidos.length} vencido(s)` : "Contas em aberto"} to="/financeiro" />
      </div>

      {/* Gráfico de faturamento + OS em andamento */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">

        {/* Gráfico */}
        {pode("financeiro") ? (
          <Card className="lg:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Faturamento — últimos 6 meses</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dadosGrafico} barGap={4}>
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`} width={48} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      brl(value),
                      name === "recebido" ? "Recebido" : "A receber",
                    ]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="recebido" name="recebido" radius={[4, 4, 0, 0]} maxBarSize={40}>
                    {dadosGrafico.map((_, i) => (
                      <Cell key={i} fill={i === dadosGrafico.length - 1 ? "oklch(0.88 0.185 101)" : "oklch(0.88 0.185 101 / 0.4)"} />
                    ))}
                  </Bar>
                  <Bar dataKey="aReceber" name="aReceber" radius={[4, 4, 0, 0]} maxBarSize={40}
                    fill="oklch(0.72 0.17 150 / 0.5)" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-3 rounded-sm bg-primary" /> Recebido
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-3 rounded-sm bg-success/50" /> A receber
                </span>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* OS em andamento */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Ordens de serviço em andamento</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            {abertas.length === 0 ? (
              <Vazio mensagem="Nenhuma OS em aberto no momento." />
            ) : (
              abertas.slice(0, 6).map((os) => (
                <Link key={os.id} to="/os/$id" params={{ id: os.id }}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 transition-colors hover:border-primary"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {os.numero} — {nomeCliente(os.clienteId)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {placaVeiculo(os.veiculoId)} · emissão {dataBR(os.emissao)}
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
            {abertas.length > 6 ? (
              <Button asChild variant="ghost" size="sm" className="w-full">
                <Link to="/os">Ver todas ({abertas.length})</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        {/* Coluna direita */}
        <div className="space-y-4">

          {/* A vencer em 7 dias */}
          {pode("financeiro") ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">A vencer em 7 dias</CardTitle>
                <TrendingUp className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent className="space-y-2">
                {proximosSete.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-success">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Nada vencendo em breve.</span>
                  </div>
                ) : (
                  proximosSete.map((l) => (
                    <div key={l.id} className="flex items-center justify-between text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{l.descricao}</p>
                        <p className="text-xs text-muted-foreground">
                          {l.tipo === "receber" ? "Receber" : "Pagar"} · vence {dataBR(l.vencimento)}
                        </p>
                      </div>
                      <span className={`ml-2 shrink-0 font-bold ${l.tipo === "receber" ? "text-success" : "text-destructive"}`}>
                        {brl(l.valor)}
                      </span>
                    </div>
                  ))
                )}
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/financeiro">Ver financeiro</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {/* Agenda de hoje */}
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
                    <p className="font-semibold">{a.hora} · {a.nome}</p>
                    <p className="text-xs text-muted-foreground">{a.placa} · {a.servico}</p>
                  </div>
                ))
              )}
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to="/agenda">Abrir agenda</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Estoque baixo */}
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