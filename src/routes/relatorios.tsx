import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { Vazio } from "@/components/form-kit";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useColecao } from "@/lib/db";
import { brl, totaisOS } from "@/lib/calc";
import { useAuth } from "@/lib/auth";
import type { Cliente, Lancamento, OrdemServico, Peca, Veiculo } from "@/lib/schemas";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios | Ideal Jairo" },
      {
        name: "description",
        content:
          "Relatórios da Oficina Ideal Jairo: faturamento por mês, serviços mais executados, melhores clientes e margem de lucro.",
      },
      { property: "og:title", content: "Relatórios | Ideal Jairo" },
      {
        property: "og:description",
        content: "Acompanhe faturamento, margem e desempenho da oficina.",
      },
    ],
  }),
  component: RelatoriosPage,
});

const CORES = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function RelatoriosPage() {
  const { pode } = useAuth();
  const { dados: ordens } = useColecao<OrdemServico>("ordens");
  const { dados: clientes } = useColecao<Cliente>("clientes");
  const { dados: veiculos } = useColecao<Veiculo>("veiculos");
  const { dados: pecas } = useColecao<Peca>("pecas");
  const { dados: lancamentos } = useColecao<Lancamento>("lancamentos");
  const [de, setDe] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [ate, setAte] = useState(() => new Date().toISOString().slice(0, 10));

  const periodo = useMemo(
    () =>
      ordens.filter(
        (o) => o.tipo === "os" && o.emissao >= de && o.emissao <= ate,
      ),
    [ordens, de, ate],
  );

  const resumo = useMemo(() => {
    let servicos = 0;
    let pecasV = 0;
    let custo = 0;
    let total = 0;
    for (const o of periodo) {
      const t = totaisOS(o, false);
      servicos += t.totalServicos;
      pecasV += t.totalPecas;
      custo += t.custoPecas;
      total += t.total;
    }
    return {
      servicos,
      pecas: pecasV,
      custo,
      total,
      margem: total - custo,
      ticket: periodo.length ? total / periodo.length : 0,
    };
  }, [periodo]);

  const porMes = useMemo(() => {
    const mapa = new Map<string, { mes: string; faturamento: number; custo: number }>();
    for (const o of periodo) {
      const chave = o.emissao.slice(0, 7);
      const t = totaisOS(o, false);
      const atual = mapa.get(chave) ?? { mes: chave, faturamento: 0, custo: 0 };
      atual.faturamento += t.total;
      atual.custo += t.custoPecas;
      mapa.set(chave, atual);
    }
    return [...mapa.values()].sort((a, b) => a.mes.localeCompare(b.mes));
  }, [periodo]);

  const topServicos = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const o of periodo) {
      for (const i of o.itens.filter((x) => x.tipo === "servico")) {
        mapa.set(i.descricao, (mapa.get(i.descricao) ?? 0) + i.quantidade);
      }
    }
    return [...mapa.entries()]
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 5);
  }, [periodo]);

  const topClientes = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const o of periodo) {
      mapa.set(o.clienteId, (mapa.get(o.clienteId) ?? 0) + totaisOS(o, false).total);
    }
    return [...mapa.entries()]
      .map(([id, valor]) => ({
        nome: clientes.find((c) => c.id === id)?.nome ?? "Cliente removido",
        valor,
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);
  }, [periodo, clientes]);

  const inadimplencia = lancamentos
    .filter((l) => l.tipo === "receber" && !l.pagoEm && l.vencimento < ate)
    .reduce((s, l) => s + l.valor, 0);

  const Indicador = ({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) => (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <p className="font-display text-2xl font-bold text-primary">{valor}</p>
        {nota ? <p className="text-xs text-muted-foreground">{nota}</p> : null}
      </CardContent>
    </Card>
  );

  return (
    <AppLayout
      titulo="Relatórios"
      descricao="Resultados da oficina no período selecionado."
      acoes={
        <>
          <Input type="date" className="w-40" value={de} onChange={(e) => setDe(e.target.value)} />
          <Input type="date" className="w-40" value={ate} onChange={(e) => setAte(e.target.value)} />
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador titulo="Faturamento" valor={brl(resumo.total)} nota={`${periodo.length} OS`} />
        <Indicador titulo="Mão de obra" valor={brl(resumo.servicos)} />
        <Indicador titulo="Peças vendidas" valor={brl(resumo.pecas)} />
        <Indicador titulo="Ticket médio" valor={brl(resumo.ticket)} />
        {pode("ver-margem") ? (
          <>
            <Indicador titulo="Custo das peças" valor={brl(resumo.custo)} />
            <Indicador titulo="Margem estimada" valor={brl(resumo.margem)} />
          </>
        ) : null}
        <Indicador titulo="Inadimplência" valor={brl(inadimplencia)} nota="Recebimentos vencidos" />
        <Indicador
          titulo="Frota atendida"
          valor={String(new Set(periodo.map((o) => o.veiculoId)).size)}
          nota={`${veiculos.length} veículos cadastrados`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Faturamento por mês</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {porMes.length === 0 ? (
              <Vazio mensagem="Sem OS no período." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porMes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => brl(v)} />
                  <Legend />
                  <Bar dataKey="faturamento" name="Faturamento" fill={CORES[0]} radius={4} />
                  {pode("ver-margem") ? (
                    <Bar dataKey="custo" name="Custo de peças" fill={CORES[2]} radius={4} />
                  ) : null}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Serviços mais executados</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {topServicos.length === 0 ? (
              <Vazio mensagem="Sem serviços lançados no período." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={topServicos} dataKey="qtd" nameKey="nome" outerRadius={90} label>
                    {topServicos.map((s, i) => (
                      <Cell key={s.nome} fill={CORES[i % CORES.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Melhores clientes</CardTitle>
          </CardHeader>
          <CardContent>
            {topClientes.length === 0 ? (
              <Vazio mensagem="Sem faturamento no período." />
            ) : (
              <ul className="space-y-2 text-sm">
                {topClientes.map((c) => (
                  <li key={c.nome} className="flex justify-between border-b border-border pb-1">
                    <span>{c.nome}</span>
                    <strong>{brl(c.valor)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Peças no estoque mínimo</CardTitle>
          </CardHeader>
          <CardContent>
            {pecas.filter((p) => p.quantidade <= p.estoqueMinimo).length === 0 ? (
              <Vazio mensagem="Estoque saudável." />
            ) : (
              <ul className="space-y-2 text-sm">
                {pecas
                  .filter((p) => p.quantidade <= p.estoqueMinimo)
                  .map((p) => (
                    <li key={p.id} className="flex justify-between border-b border-border pb-1">
                      <span>{p.nome}</span>
                      <span className="text-warning">
                        {p.quantidade} un (mín. {p.estoqueMinimo})
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
