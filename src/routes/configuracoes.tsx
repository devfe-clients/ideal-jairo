import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Database, Save, Server, ShieldCheck, ToggleLeft, ToggleRight, X } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { CampoTexto } from "@/components/form-kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { configSchema, type Config, type ServicoBase } from "@/lib/schemas";
import { modoBanco, useColecao } from "@/lib/db";
import { dataBR } from "@/lib/calc";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações | Ideal Jairo" },
      {
        name: "description",
        content:
          "Configurações de atendimento, horários e infraestrutura do sistema da Oficina Ideal Jairo.",
      },
      { property: "og:title", content: "Configurações | Ideal Jairo" },
      {
        property: "og:description",
        content: "Configure horários, capacidade da agenda e serviços oferecidos pela oficina.",
      },
    ],
  }),
  component: ConfiguracoesPage,
});

type ConfigRegistro = Config & { id: string };

const DIAS = [
  { numero: 0, nome: "Domingo" },
  { numero: 1, nome: "Segunda" },
  { numero: 2, nome: "Terça" },
  { numero: 3, nome: "Quarta" },
  { numero: 4, nome: "Quinta" },
  { numero: 5, nome: "Sexta" },
  { numero: 6, nome: "Sábado" },
];

type ExcecaoLocal = {
  data: string;
  fechado: boolean;
  limitePorHorario?: number | undefined;
  servicosDisponiveis?: string[] | undefined;
  horariosBlockeados?: string[] | undefined;
  observacao?: string | undefined;
};

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

function ConfiguracoesPage() {  const { usuario } = useAuth();
  const { dados, salvar } = useColecao<ConfigRegistro>("config");
  const { dados: servicos, salvar: salvarServico } = useColecao<ServicoBase>("servicos");
  const [config, setConfig] = useState<ConfigRegistro | null>(null);
  const [servicosTexto, setServicosTexto] = useState("");
  const [bloqueiosTexto, setBloqueiosTexto] = useState("");
const [calAno, setCalAno] = useState(() => new Date().getFullYear());
  const [calMes, setCalMes] = useState(() => new Date().getMonth());
  const [modalExcecao, setModalExcecao] = useState<ExcecaoLocal | null>(null);
  const [modalData, setModalData] = useState<string | null>(null);

  useEffect(() => {
    const atual = dados[0];
    if (!atual || config) return;
    setConfig(structuredClone(atual));
    setServicosTexto(atual.servicos.join("\n"));
    setBloqueiosTexto(atual.diasBloqueados.join("\n"));
    // excecoesData já vem dentro do config clonado
  }, [dados, config]);

  async function confirmar() {
    if (!config) return;
    const candidato = {
      ...config,
      servicos: servicosTexto
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      diasBloqueados: bloqueiosTexto
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    const validado = configSchema.safeParse(candidato);
    if (!validado.success) {
      toast.error(validado.error.issues[0]?.message ?? "Configuração inválida.");
      return;
    }
    const registro: ConfigRegistro = { ...validado.data, id: config.id };
    await salvar(registro, usuario?.nome ?? "sistema");
    setConfig(registro);
    toast.success("Configurações salvas.");
  }

  if (!config) {
    return (
      <AppLayout titulo="Configurações">
        <p className="text-sm text-muted-foreground">Carregando configurações...</p>
      </AppLayout>
    );
  }

function diasDoMes(ano: number, mes: number) {
    const primeiro = new Date(ano, mes, 1).getDay();
    const total = new Date(ano, mes + 1, 0).getDate();
    return { primeiro, total };
  }

  function excecaoDa(data: string): ExcecaoLocal | undefined {
    if (!config) return undefined;
    return (config.excecoesData ?? []).find((e) => e.data === data);
  }

  function abrirModalDia(data: string) {
    const exc = excecaoDa(data);
    setModalExcecao(exc ?? {
      data,
      fechado: false,
      observacao: "",
    });
    setModalData(data);
  }

  function salvarExcecao(exc: ExcecaoLocal) {
    if (!config) return;
    const sem = (config.excecoesData ?? []).filter((e) => e.data !== exc.data);
    // se nada foi configurado, remove a exceção (limpa o dia)
    const vazia =
      !exc.fechado &&
      !exc.limitePorHorario &&
      (!exc.servicosDisponiveis || exc.servicosDisponiveis.length === 0) &&
      (!exc.horariosBlockeados || exc.horariosBlockeados.length === 0) &&
      !exc.observacao;
    setConfig({
      ...config,
      excecoesData: vazia ? sem : [...sem, exc],
    } as typeof config);
    setModalExcecao(null);
    setModalData(null);
  }

  function removerExcecao(data: string) {
    if (!config) return;
    setConfig({
      ...config,
      excecoesData: (config.excecoesData ?? []).filter((e) => e.data !== data),
    } as typeof config);
  }

  function horariosDoConfigGeral() {
    if (!config) return [];
    const [hi, mi] = config.horaInicio.split(":").map(Number);
    const [hf, mf] = config.horaFim.split(":").map(Number);
    const inicio = (hi ?? 8) * 60 + (mi ?? 0);
    const fim = (hf ?? 18) * 60 + (mf ?? 0);
    const slots: string[] = [];
    for (let m = inicio; m < fim; m += config.intervaloMinutos) {
      slots.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
    }
    return slots;
  }

  const { primeiro, total } = diasDoMes(calAno, calMes);
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <AppLayout
      titulo="Configurações"
      descricao="Horários usados pela agenda pública e estado da infraestrutura."
      acoes={
        <Button size="sm" onClick={() => void confirmar()}>
          <Save className="mr-1 h-4 w-4" /> Salvar
        </Button>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Agenda pública</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <CampoTexto
                  label="Horário de abertura"
                  type="time"
                  valor={config.horaInicio}
                  onChange={(v) => setConfig({ ...config, horaInicio: v })}
                />
                <CampoTexto
                  label="Horário de encerramento"
                  type="time"
                  valor={config.horaFim}
                  onChange={(v) => setConfig({ ...config, horaFim: v })}
                />
                <CampoTexto
                  label="Intervalo entre horários (minutos)"
                  type="number"
                  valor={String(config.intervaloMinutos)}
                  onChange={(v) =>
                    setConfig({ ...config, intervaloMinutos: Number(v) || 0 })
                  }
                />
                <CampoTexto
                  label="Veículos por horário"
                  type="number"
                  valor={String(config.limitePorHorario)}
                  onChange={(v) =>
                    setConfig({ ...config, limitePorHorario: Number(v) || 0 })
                  }
                />
              </div>

              <div>
                <p className="mb-2 text-xs uppercase text-muted-foreground">Dias de atendimento</p>
                <div className="flex flex-wrap gap-3">
                  {DIAS.map((dia) => (
                    <label key={dia.numero} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={config.diasAtendimento.includes(dia.numero)}
                        onCheckedChange={(marcado) =>
                          setConfig({
                            ...config,
                            diasAtendimento: marcado
                              ? [...config.diasAtendimento, dia.numero].sort()
                              : config.diasAtendimento.filter((d) => d !== dia.numero),
                          })
                        }
                      />
                      {dia.nome}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase text-muted-foreground">Serviços cadastrados</p>
                <div className="mb-2 flex gap-2">
                  <input
                    className="h-8 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                    placeholder="Nome do novo serviço..."
                    id="novo-servico-input"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const input = e.currentTarget;
                        const nome = input.value.trim();
                        if (!nome) return;
                        const jaExiste = servicosTexto.split("\n").some((s) => s.trim().toLowerCase() === nome.toLowerCase());
                        if (!jaExiste) setServicosTexto((prev) => (prev ? prev + "\n" + nome : nome));
                        input.value = "";
                      }
                    }}
                  />
                  <Button size="sm" variant="outline" onClick={() => {
                    const input = document.getElementById("novo-servico-input") as HTMLInputElement | null;
                    if (!input) return;
                    const nome = input.value.trim();
                    if (!nome) return;
                    const jaExiste = servicosTexto.split("\n").some((s) => s.trim().toLowerCase() === nome.toLowerCase());
                    if (!jaExiste) setServicosTexto((prev) => (prev ? prev + "\n" + nome : nome));
                    input.value = "";
                  }}>Adicionar</Button>
                </div>
                <div className="space-y-1 rounded-md border border-border">
                  {servicosTexto.split("\n").map((s) => s.trim()).filter(Boolean).map((nome, idx) => {
                    const srv = servicos.find((s) => s.nome === nome);
                    const disponivel = srv ? (srv.disponivelParaAgendamento ?? true) : true;
                    return (
                      <div key={idx} className="flex items-center justify-between gap-2 px-3 py-2 even:bg-muted/40">
                        <span className="text-sm">{nome}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs ${disponivel ? "text-success" : "text-muted-foreground"}`}>
                            {disponivel ? "Disponível" : "Indisponível"}
                          </span>
                          <button
                            type="button"
                            title={disponivel ? "Clique para tornar indisponível" : "Clique para tornar disponível"}
                            onClick={async () => {
                              if (!srv) { toast.error("Salve as configurações antes de alterar a disponibilidade."); return; }
                              await salvarServico({ ...srv, disponivelParaAgendamento: !disponivel }, usuario?.uid ?? "sistema");
                              toast.success(`Serviço ${!disponivel ? "disponível" : "indisponível"} para agendamento.`);
                            }}
                          >
                            {disponivel
                              ? <ToggleRight className="h-5 w-5 text-success" />
                              : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                          </button>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-destructive"
                            title="Remover serviço"
                            onClick={() => setServicosTexto((prev) =>
                              prev.split("\n").filter((s) => s.trim() !== nome).join("\n")
                            )}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {!servicosTexto.trim() && (
                    <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                      Nenhum serviço cadastrado.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs uppercase text-muted-foreground">Calendário de exceções</p>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => {
                      if (calMes === 0) { setCalMes(11); setCalAno(calAno - 1); }
                      else setCalMes(calMes - 1);
                    }}><ChevronLeft className="h-4 w-4" /></button>
                    <span className="min-w-32 text-center text-sm font-medium">
                      {MESES[calMes]} {calAno}
                    </span>
                    <button type="button" onClick={() => {
                      if (calMes === 11) { setCalMes(0); setCalAno(calAno + 1); }
                      else setCalMes(calMes + 1);
                    }}><ChevronRight className="h-4 w-4" /></button>
                  </div>
                </div>

                <div className="rounded-md border border-border p-3">
                  <div className="mb-1 grid grid-cols-7 text-center text-[10px] uppercase text-muted-foreground">
                    {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d) => (
                      <div key={d}>{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: primeiro }).map((_, i) => <div key={`v${i}`} />)}
                    {Array.from({ length: total }).map((_, i) => {
                      const dia = i + 1;
                      const dataStr = `${calAno}-${String(calMes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
                      const exc = excecaoDa(dataStr);
                      const ehHoje = dataStr === hoje;
                      const diaSemana = new Date(`${dataStr}T12:00:00`).getDay();
                      const diaAtendimento = config.diasAtendimento.includes(diaSemana);
                      return (
                        <button
                          key={dia}
                          type="button"
                          title={exc?.observacao ?? (exc?.fechado ? "Fechado" : diaAtendimento ? "Dia normal" : "Sem atendimento")}
                          onClick={() => abrirModalDia(dataStr)}
                          className={[
                            "relative flex h-8 w-full items-center justify-center rounded text-xs transition-colors",
                            ehHoje ? "ring-2 ring-primary ring-offset-1" : "",
                            exc?.fechado ? "bg-destructive/15 text-destructive font-semibold" :
                            exc ? "bg-warning/15 text-warning font-semibold" :
                            diaAtendimento ? "hover:bg-muted" :
                            "text-muted-foreground/50 hover:bg-muted",
                          ].join(" ")}
                        >
                          {dia}
                          {exc ? (
                            <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-warning" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-destructive/50" /> Fechado</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-warning/60" /> Exceção configurada</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/30" /> Sem atendimento (padrão)</span>
                </div>

                {(config.excecoesData ?? []).length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-[11px] uppercase text-muted-foreground">Exceções ativas</p>
                    {(config.excecoesData ?? [])
                      .sort((a, b) => a.data.localeCompare(b.data))
                      .map((exc) => (
                        <div key={exc.data} className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1.5 text-xs">
                          <div>
                            <span className="font-medium">{dataBR(exc.data)}</span>
                            {exc.fechado && <span className="ml-2 text-destructive">Fechado</span>}
                            {exc.limitePorHorario && <span className="ml-2 text-muted-foreground">{exc.limitePorHorario} veíc./horário</span>}
                            {exc.observacao && <span className="ml-2 text-muted-foreground">· {exc.observacao}</span>}
                          </div>
                          <div className="flex gap-1">
                            <button type="button" onClick={() => abrirModalDia(exc.data)} className="text-muted-foreground hover:text-foreground">
                              <CalendarDays className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => removerExcecao(exc.data)} className="text-muted-foreground hover:text-destructive">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4 text-primary" /> Banco de dados / anotações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Modo atual</span>
                <Badge variant="secondary">{modoBanco}</Badge>
              </div>
              <p className="text-muted-foreground">
Firebase (banco) / Cloudfire R2 (Storange)              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-primary" /> Segurança / anotações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Validação compartilhada já estruturada para tela e servidor.</p>
              <p>Permissões separadas por perfil e administrador com acesso total.</p>
              <p>Histórico de criação, alteração e exclusão já registrado.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-4 w-4 text-primary" /> Publicação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>©2026 Ideal Jairo - Oficina.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {modalData && modalExcecao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-background p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">{dataBR(modalData)}</h2>
              <button type="button" onClick={() => { setModalExcecao(null); setModalData(null); }}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={modalExcecao.fechado}
                  onCheckedChange={(v) => setModalExcecao({ ...modalExcecao, fechado: Boolean(v) })}
                />
                <span className="font-medium text-destructive">Fechar este dia</span>
              </label>

              {!modalExcecao.fechado && (
                <>
                  <div>
                    <label className="mb-1 block text-xs uppercase text-muted-foreground">
                      Veículos por horário (deixe vazio para usar o padrão: {config.limitePorHorario})
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm"
                      placeholder={String(config.limitePorHorario)}
                      value={modalExcecao.limitePorHorario ?? ""}
                      onChange={(e) => setModalExcecao({
                        ...modalExcecao,
                        limitePorHorario: e.target.value ? Number(e.target.value) : undefined,
                      })}
                    />
                  </div>

                  <div>
                    <p className="mb-1 text-xs uppercase text-muted-foreground">Horários bloqueados neste dia</p>
                    <div className="flex flex-wrap gap-1.5">
                      {horariosDoConfigGeral().map((h) => {
                        const bloqueado = (modalExcecao.horariosBlockeados ?? []).includes(h);
                        return (
                          <button
                            key={h}
                            type="button"
                            onClick={() => setModalExcecao({
                              ...modalExcecao,
                              horariosBlockeados: bloqueado
                                ? (modalExcecao.horariosBlockeados ?? []).filter((x) => x !== h)
                                : [...(modalExcecao.horariosBlockeados ?? []), h],
                            })}
                            className={`rounded px-2 py-1 text-xs border transition-colors ${
                              bloqueado
                                ? "border-destructive bg-destructive/10 text-destructive"
                                : "border-border hover:border-primary"
                            }`}
                          >
                            {h}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="mb-1 text-xs uppercase text-muted-foreground">
                      Serviços disponíveis neste dia
                      <span className="ml-1 normal-case text-muted-foreground">(vazio = todos os disponíveis)</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {servicos.filter((s) => s.disponivelParaAgendamento !== false).map((s) => {
                        const lista = modalExcecao.servicosDisponiveis;
                        const selecionado = !lista || lista.includes(s.nome);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              const atual = modalExcecao.servicosDisponiveis
                                ?? servicos.filter((x) => x.disponivelParaAgendamento !== false).map((x) => x.nome);
                              const nova = selecionado
                                ? atual.filter((n) => n !== s.nome)
                                : [...atual, s.nome];
                              const todosDisponiveis = servicos
                                .filter((x) => x.disponivelParaAgendamento !== false)
                                .every((x) => nova.includes(x.nome));
              setModalExcecao({
                ...modalExcecao,
                ...(todosDisponiveis
                  ? { servicosDisponiveis: undefined }
                  : { servicosDisponiveis: nova }),
              });
                            }}
                            className={`rounded px-2 py-1 text-xs border transition-colors ${
                              selecionado
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground line-through"
                            }`}
                          >
                            {s.nome}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="mb-1 block text-xs uppercase text-muted-foreground">Observação interna</label>
                <input
                  className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm"
                  placeholder="Ex: Feriado municipal"
                  value={modalExcecao.observacao ?? ""}
                  onChange={(e) => setModalExcecao({ ...modalExcecao, observacao: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded-md border border-border px-3 py-1.5 text-sm"
                onClick={() => { setModalExcecao(null); setModalData(null); }}>
                Cancelar
              </button>
              <button type="button" className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                onClick={() => salvarExcecao(modalExcecao)}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}