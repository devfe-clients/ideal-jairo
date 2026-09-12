import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { Campo, Vazio } from "@/components/form-kit";
import { useColecao } from "@/lib/db";
import type { Cliente, OrdemServico, Veiculo } from "@/lib/schemas";
import { osStatus } from "@/lib/schemas";
import { brl, dataBR, totaisOS } from "@/lib/calc";
import { novaOrdem } from "@/lib/os-helpers";
import { useAuth } from "@/lib/auth";

export function ListaOS({ tipo }: { tipo: "os" | "orcamento" }) {
  const { dados: ordens, salvar } = useColecao<OrdemServico>("ordens");
  const { dados: clientes } = useColecao<Cliente>("clientes");
  const { dados: veiculos } = useColecao<Veiculo>("veiculos");
  const { usuario } = useAuth();
  const [texto, setTexto] = useState("");
  const [status, setStatus] = useState("aberto");
  const [aberto, setAberto] = useState(false);
  const [novoCliente, setNovoCliente] = useState("");
  const [novoVeiculo, setNovoVeiculo] = useState("");

  const lista = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return ordens
      .filter((o) => o.tipo === tipo)
      .filter((o) => {
        if (status === "todos") return true;
        if (status === "aberto") return o.status !== "Finalizado" && o.status !== "Entregue/Fechado";
        return o.status === status;
      })
      .filter((o) => {
        if (!t) return true;
        const c = clientes.find((x) => x.id === o.clienteId);
        const v = veiculos.find((x) => x.id === o.veiculoId);
        return (
          o.numero.toLowerCase().includes(t) ||
          (c?.nome ?? "").toLowerCase().includes(t) ||
          (v?.placa ?? "").toLowerCase().includes(t)
        );
      });
  }, [ordens, tipo, status, texto, clientes, veiculos]);

  const veiculosDoCliente = veiculos.filter((v) => v.clienteId === novoCliente);

  async function criar() {
    if (!novoCliente || !novoVeiculo) {
      toast.error("Selecione cliente e veículo.");
      return;
    }
    const veiculo = veiculos.find((v) => v.id === novoVeiculo);
    const nova = novaOrdem(ordens, tipo, novoCliente, novoVeiculo, veiculo?.km ?? 0, usuario?.uid ?? "sistema");
    await salvar(nova, usuario?.uid ?? "sistema");
    toast.success(`${nova.numero} criada.`);
    setAberto(false);
    setNovoCliente("");
    setNovoVeiculo("");
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por número, cliente ou placa..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="aberto">Em aberto</SelectItem>
            <SelectItem value="todos">Todos os status</SelectItem>
            {osStatus.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setAberto(true)}>
          <Plus className="mr-1 h-4 w-4" /> {tipo === "os" ? "Nova OS" : "Novo orçamento"}
        </Button>
      </div>

      {lista.length === 0 ? (
        <Vazio mensagem="Nenhum registro encontrado." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((o) => {
            const c = clientes.find((x) => x.id === o.clienteId);
            const v = veiculos.find((x) => x.id === o.veiculoId);
            const t = totaisOS(o, o.tipo === "orcamento");
            return (
              <Link key={o.id} to="/os/$id" params={{ id: o.id }}>
                <Card className="h-full transition-colors hover:border-primary">
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-display font-bold text-primary">{o.numero}</p>
                      <Badge variant="secondary">{o.status}</Badge>
                    </div>
                    <p className="truncate text-sm font-medium">{c?.nome ?? "Sem cliente"}</p>
                    <p className="text-xs text-muted-foreground">
                      {v ? `${v.placa} · ${v.marca} ${v.modelo}` : "Sem veículo"}
                    </p>
                    <p className="text-xs text-muted-foreground">Emissão {dataBR(o.emissao)}</p>
                    <div className="flex items-center justify-between pt-1 text-sm">
                      <span className="text-xs text-muted-foreground">
                        Peças {brl(t.totalPecas)} · M.O. {brl(t.totalServicos)}
                      </span>
                      <strong>{brl(t.total)}</strong>
                    </div>
                    {tipo === "orcamento" ? (
                      <Badge
                        variant="outline"
                        className={
                          o.aprovacao === "Aprovado"
                            ? "text-success"
                            : o.aprovacao === "Recusado"
                              ? "text-destructive"
                              : "text-warning"
                        }
                      >
                        {o.aprovacao}
                      </Badge>
                    ) : null}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tipo === "os" ? "Nova ordem de serviço" : "Novo orçamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Campo label="Cliente">
              <Select
                value={novoCliente}
                onValueChange={(v) => {
                  setNovoCliente(v);
                  setNovoVeiculo("");
                }}
              >
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
            <Campo label="Veículo">
              <Select value={novoVeiculo} onValueChange={setNovoVeiculo} disabled={!novoCliente}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o veículo" />
                </SelectTrigger>
                <SelectContent>
                  {veiculosDoCliente.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.placa} — {v.marca} {v.modelo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={criar}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
