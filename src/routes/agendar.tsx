import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.jpg.asset.json";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { formatarDoc, formatarPlaca, formatarTelefone } from "@/lib/calc";
import { EMPRESA } from "@/lib/empresa";

export const Route = createFileRoute("/agendar")({
  head: () => ({
    meta: [
      { title: "Agendar serviço | Oficina Ideal Jairo" },
      {
        name: "description",
        content:
          "Agende online o serviço do seu carro na Oficina Ideal Jairo em Praia Grande/SP. Escolha data e horário disponíveis.",
      },
      { property: "og:title", content: "Agendar serviço | Oficina Ideal Jairo" },
      {
        property: "og:description",
        content: "Agendamento online rápido para mecânica automotiva em Praia Grande/SP.",
      },
    ],
  }),
  component: AgendarPublico,
});

const vazio = {
  nome: "",
  cpfCnpj: "",
  telefone: "",
  email: "",
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
  status: "Pendente",
  consentimentoLgpd: false,
};

function horariosDoDia(config: Config | undefined, data: string, ocupados: string[]) {
  if (!config || !data) return [];
  const dia = new Date(`${data}T12:00:00`).getDay();
  if (!config.diasAtendimento.includes(dia)) return [];
  if (config.diasBloqueados.includes(data)) return [];
  const [hi, mi] = config.horaInicio.split(":").map(Number);
  const [hf, mf] = config.horaFim.split(":").map(Number);
  const inicio = (hi ?? 8) * 60 + (mi ?? 0);
  const fim = (hf ?? 18) * 60 + (mf ?? 0);
  const slots: string[] = [];
  for (let m = inicio; m < fim; m += config.intervaloMinutos) {
    const hora = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    const usados = ocupados.filter((o) => o === hora).length;
    if (usados < config.limitePorHorario) slots.push(hora);
  }
  return slots;
}

function AgendarPublico() {
  const { dados: agendamentos, salvar } = useColecao<Agendamento>("agendamentos");
  const { dados: configs } = useColecao<Config & { id: string }>("config");
  const { dados: servicos } = useColecao<ServicoBase>("servicos");
  const [enviado, setEnviado] = useState<Agendamento | null>(null);
  const form = useFormularioZod(agendamentoSchema, vazio);
  const config = configs[0];
  const data = String(form.valores["data"] ?? "");

  const horarios = useMemo(
    () =>
      horariosDoDia(
        config,
        data,
        agendamentos.filter((a) => a.data === data && a.status !== "Cancelado").map((a) => a.hora),
      ),
    [config, data, agendamentos],
  );

  async function enviar() {
    const dados = form.validar();
    if (!dados) {
      toast.error("Confira os campos destacados.");
      return;
    }
    if (!horarios.includes(dados.hora)) {
      form.setErros((e) => ({ ...e, hora: "Horário indisponível, escolha outro." }));
      return;
    }
    const registro = {
      ...dados,
      id: novoId(),
      criadoEm: new Date().toISOString(),
    } as Agendamento;
    await salvar(registro, "agendamento-online");
    setEnviado(registro);
  }

  if (enviado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="space-y-3 p-8">
            <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
            <h1 className="text-xl font-bold">Agendamento enviado!</h1>
            <p className="text-sm text-muted-foreground">
              {enviado.nome}, recebemos seu pedido para{" "}
              <strong>{new Date(`${enviado.data}T12:00:00`).toLocaleDateString("pt-BR")}</strong> às{" "}
              <strong>{enviado.hora}</strong>. A oficina confirmará por WhatsApp no número{" "}
              {formatarTelefone(enviado.telefone)}.
            </p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Fazer outro agendamento
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-5">
          <img src={logo.url} alt="Ideal Jairo" className="h-12 w-12 rounded-md object-cover" />
          <div>
            <h1 className="font-display text-xl font-bold">Agende seu serviço</h1>
            <p className="text-xs text-muted-foreground">
              {EMPRESA.nome} · {EMPRESA.endereco} · {EMPRESA.cidade}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <Card>
          <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
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
              label="Endereço"
              valor={String(form.valores["endereco"] ?? "")}
              erro={form.erros["endereco"]}
              onChange={(v) => form.set("endereco", v)}
            />
            <CampoTexto
              label="Placa"
              valor={formatarPlaca(String(form.valores["placa"] ?? ""))}
              erro={form.erros["placa"]}
              onChange={(v) => form.set("placa", formatarPlaca(v))}
            />
            <CampoTexto
              label="Marca"
              valor={String(form.valores["marca"] ?? "")}
              erro={form.erros["marca"]}
              onChange={(v) => form.set("marca", v)}
            />
            <CampoTexto
              label="Modelo"
              valor={String(form.valores["modelo"] ?? "")}
              erro={form.erros["modelo"]}
              onChange={(v) => form.set("modelo", v)}
            />
            <CampoTexto
              label="Ano"
              type="number"
              valor={String(form.valores["ano"] ?? "")}
              erro={form.erros["ano"]}
              onChange={(v) => form.set("ano", v)}
            />
            <CampoTexto
              label="Quilometragem"
              type="number"
              valor={String(form.valores["km"] ?? "")}
              erro={form.erros["km"]}
              onChange={(v) => form.set("km", v)}
            />

            <Campo label="Serviço desejado" erro={form.erros["servico"]}>
              <Select
                value={String(form.valores["servico"] ?? "")}
                onValueChange={(v) => form.set("servico", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o serviço" />
                </SelectTrigger>
                <SelectContent>
                  {servicos.map((s) => (
                    <SelectItem key={s.id} value={s.nome}>
                      {s.nome}
                    </SelectItem>
                  ))}
                  <SelectItem value="Outro / não sei informar">Outro / não sei informar</SelectItem>
                </SelectContent>
              </Select>
            </Campo>

            <CampoTexto
              label="Data"
              type="date"
              valor={data}
              erro={form.erros["data"]}
              onChange={(v) => {
                form.set("data", v);
                form.set("hora", "");
              }}
            />

            <Campo
              label="Horário disponível"
              erro={form.erros["hora"]}
              className="sm:col-span-2"
              dica={
                data && horarios.length === 0
                  ? "Sem horários nesta data. Escolha outro dia."
                  : "Só aparecem horários realmente livres."
              }
            >
              <div className="flex flex-wrap gap-2">
                {horarios.map((h) => (
                  <Button
                    key={h}
                    type="button"
                    size="sm"
                    variant={form.valores["hora"] === h ? "default" : "outline"}
                    onClick={() => form.set("hora", h)}
                  >
                    {h}
                  </Button>
                ))}
              </div>
            </Campo>

            <CampoArea
              label="Descrição do problema"
              className="sm:col-span-2"
              valor={String(form.valores["descricao"] ?? "")}
              erro={form.erros["descricao"]}
              onChange={(v) => form.set("descricao", v)}
            />

            <div className="sm:col-span-2">
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={Boolean(form.valores["consentimentoLgpd"])}
                  onCheckedChange={(v) => form.set("consentimentoLgpd", Boolean(v))}
                />
                <span>
                  Autorizo o uso dos meus dados para atendimento e contato, conforme a LGPD.
                </span>
              </label>
              {form.erros["consentimentoLgpd"] ? (
                <p className="mt-1 text-[11px] font-medium text-destructive">
                  {form.erros["consentimentoLgpd"]}
                </p>
              ) : null}
            </div>

            <Button className="sm:col-span-2" onClick={enviar}>
              Confirmar agendamento
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
