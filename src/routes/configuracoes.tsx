import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Database, Save, Server, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { CampoTexto } from "@/components/form-kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { configSchema, type Config } from "@/lib/schemas";
import { modoBanco, useColecao } from "@/lib/db";
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

function ConfiguracoesPage() {
  const { usuario } = useAuth();
  const { dados, salvar } = useColecao<ConfigRegistro>("config");
  const [config, setConfig] = useState<ConfigRegistro | null>(null);
  const [servicosTexto, setServicosTexto] = useState("");
  const [bloqueiosTexto, setBloqueiosTexto] = useState("");

  useEffect(() => {
    const atual = dados[0];
    if (!atual || config) return;
    setConfig(structuredClone(atual));
    setServicosTexto(atual.servicos.join("\n"));
    setBloqueiosTexto(atual.diasBloqueados.join("\n"));
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
    await salvar(registro, usuario.nome);
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

              <label className="block space-y-1.5">
                <span className="text-xs uppercase text-muted-foreground">
                  Serviços oferecidos (um por linha)
                </span>
                <textarea
                  rows={7}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={servicosTexto}
                  onChange={(e) => setServicosTexto(e.target.value)}
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs uppercase text-muted-foreground">
                  Datas bloqueadas (AAAA-MM-DD, uma por linha)
                </span>
                <textarea
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={bloqueiosTexto}
                  onChange={(e) => setBloqueiosTexto(e.target.value)}
                />
              </label>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4 text-primary" /> Banco de dados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Modo atual</span>
                <Badge variant="secondary">{modoBanco}</Badge>
              </div>
              <p className="text-muted-foreground">
                O frontend está pronto para receber as chaves do Firebase. Até lá, os dados de
                demonstração ficam somente neste navegador.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-primary" /> Segurança
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
              <p>Destino previsto: Vercel.</p>
              <p>Firebase e armazenamento de fotos ainda aguardam as chaves do projeto.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}