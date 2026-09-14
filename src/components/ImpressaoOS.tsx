const logo = { url: "/logo-ideal-jairo.jpg" };
import { EMPRESA } from "@/lib/empresa";
import { brl, dataBR, formatarDoc, formatarTelefone, itemTotal, totaisOS } from "@/lib/calc";
import type { Checklist, Cliente, OrdemServico, Usuario, Veiculo } from "@/lib/schemas";

export function ImpressaoOS({
  os,
  cliente,
  veiculo,
  mecanicos,
}: {
  os: OrdemServico;
  cliente?: Cliente | undefined;
  veiculo?: Veiculo | undefined;
  mecanicos: Usuario[];
}) {
  const t = totaisOS(os, os.tipo === "orcamento");
  const itens = os.tipo === "orcamento" ? os.itens.filter((i) => i.aprovado) : os.itens;
  const servicos = itens.filter((i) => i.tipo === "servico");
  const pecas = itens.filter((i) => i.tipo === "peca");
  const nomeMecanico = (id?: string) => mecanicos.find((m) => m.id === id)?.nome;

  const Tabela = ({ titulo, linhas }: { titulo: string; linhas: typeof itens }) =>
    linhas.length === 0 ? null : (
      <table className="mt-3 w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th
              colSpan={5}
              className="border border-black bg-black px-2 py-1 text-left font-bold uppercase text-white print:bg-black"
            >
              {titulo}
            </th>
          </tr>
          <tr>
            <th className="border border-black px-2 py-1 text-left">Descrição</th>
            <th className="w-14 border border-black px-2 py-1">Qtd</th>
            <th className="w-24 border border-black px-2 py-1">V. Unit</th>
            <th className="w-20 border border-black px-2 py-1">Desc.</th>
            <th className="w-24 border border-black px-2 py-1">Total</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((i) => (
            <tr key={i.id}>
              <td className="border border-black px-2 py-1">
                {i.descricao}
                {i.tipo === "servico" && nomeMecanico(i.mecanicoId)
                  ? ` — mecânico: ${nomeMecanico(i.mecanicoId)}`
                  : ""}
              </td>
              <td className="border border-black px-2 py-1 text-center">{i.quantidade}</td>
              <td className="border border-black px-2 py-1 text-right">
                {i.valorUnitario.toFixed(2)}
              </td>
              <td className="border border-black px-2 py-1 text-right">{i.desconto.toFixed(2)}</td>
              <td className="border border-black px-2 py-1 text-right">
                {itemTotal(i).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );

  const Vistoria = ({ titulo, c }: { titulo: string; c?: Checklist | undefined }) => {
    if (!c) return null;
    const marcados = Object.entries(c.itens).filter(([, v]) => v);
    return (
      <div className="mt-3 border border-black p-2 text-[11px]">
        <p className="font-bold uppercase">{titulo}</p>
        <p>
          Hodômetro: {c.hodometro.toLocaleString("pt-BR")} km · Combustível: {c.combustivel}
        </p>
        {marcados.length > 0 ? (
          <ul className="mt-1 grid grid-cols-2 gap-x-4 sm:grid-cols-3">
            {marcados.map(([k, v]) => (
              <li key={k}>
                <strong>{k}:</strong> {v}
              </li>
            ))}
          </ul>
        ) : null}
        {c.observacoes ? <p className="mt-1">Obs.: {c.observacoes}</p> : null}
        {c.fotos.length > 0 ? (
          <div className="mt-2 grid grid-cols-4 gap-1">
            {c.fotos.map((f, idx) => (
              <img
                key={f.slice(0, 24) + idx}
                src={f}
                alt={`Foto da vistoria ${idx + 1}`}
                className="h-20 w-full rounded object-cover"
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="print-sheet mx-auto max-w-[820px] bg-white p-6 text-black">
      <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
        <div className="flex items-center gap-3">
          <img src={logo.url} alt="Ideal Jairo" className="h-14 w-14 rounded object-cover" />
          <div className="text-[11px] leading-tight">
            <p className="text-base font-bold uppercase">{EMPRESA.nome}</p>
            <p>CNPJ: {EMPRESA.cnpj}</p>
            <p>{EMPRESA.endereco}</p>
            <p>
              {EMPRESA.bairro} - {EMPRESA.cidade} - CEP: {EMPRESA.cep}
            </p>
            <p>Tel: {EMPRESA.telefone}</p>
          </div>
        </div>
        <div className="text-right text-[11px] leading-tight">
          <p className="text-base font-bold uppercase">
            {os.tipo === "os" ? "Ordem de Serviço" : "Orçamento"}
          </p>
          <p className="font-bold">Nº {os.numero}</p>
          <p>Emissão: {dataBR(os.emissao)}</p>
          {os.previsao ? <p>Previsão: {dataBR(os.previsao)}</p> : null}
          {os.saida ? <p>Saída: {dataBR(os.saida)}</p> : null}
          <p>Status: {os.status}</p>
          <p>Prioridade: {os.prioridade}</p>
        </div>
      </header>

      <section className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
        <div className="border border-black p-2">
          <p className="font-bold uppercase">Dados do cliente</p>
          {cliente ? (
            <>
              <p>{cliente.nome}</p>
              <p>CPF/CNPJ: {formatarDoc(cliente.cpfCnpj)}</p>
              <p>Contato: {formatarTelefone(cliente.telefone)}</p>
              {cliente.endereco ? (
                <p>
                  {cliente.endereco}
                  {cliente.numero ? `, ${cliente.numero}` : ""}
                  {cliente.bairro ? ` - ${cliente.bairro}` : ""}
                  {cliente.cidade ? ` - ${cliente.cidade}/${cliente.uf}` : ""}
                </p>
              ) : null}
            </>
          ) : null}
          <p>Resp. técnico: {EMPRESA.responsavelTecnico}</p>
        </div>
        <div className="border border-black p-2">
          <p className="font-bold uppercase">Dados do veículo</p>
          {veiculo ? (
            <>
              <p>
                {veiculo.marca} {veiculo.modelo} ({veiculo.ano})
              </p>
              <p>Placa: {veiculo.placa}</p>
              {veiculo.cor ? <p>Cor: {veiculo.cor}</p> : null}
              {veiculo.motor ? <p>Motor: {veiculo.motor}</p> : null}
              {veiculo.chassi ? <p>Chassi: {veiculo.chassi}</p> : null}
            </>
          ) : null}
          <p>KM: {os.km.toLocaleString("pt-BR")} km</p>
        </div>
      </section>

      {os.reclamacao ? (
        <div className="mt-3 border border-black p-2 text-[11px]">
          <p className="font-bold uppercase">Problema relatado</p>
          <p>{os.reclamacao}</p>
        </div>
      ) : null}

      <Tabela titulo="Serviços executados" linhas={servicos} />
      <Tabela titulo="Peças e materiais aplicados" linhas={pecas} />

      {os.diagnostico || os.observacoes ? (
        <div className="mt-3 border border-black p-2 text-[11px]">
          {os.diagnostico ? (
            <p>
              <strong>Laudo técnico:</strong> {os.diagnostico}
            </p>
          ) : null}
          {os.observacoes ? (
            <p>
              <strong>Observações:</strong> {os.observacoes}
            </p>
          ) : null}
        </div>
      ) : null}

      <Vistoria titulo="Vistoria de entrada" c={os.checklistEntrada} />
      <Vistoria titulo="Vistoria de saída" c={os.checklistSaida} />

      <section className="mt-3 flex justify-end">
        <table className="text-[12px]">
          <tbody>
            <tr>
              <td className="border border-black px-3 py-1">Total serviços:</td>
              <td className="border border-black px-3 py-1 text-right">{brl(t.totalServicos)}</td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-1">Total peças:</td>
              <td className="border border-black px-3 py-1 text-right">{brl(t.totalPecas)}</td>
            </tr>
            {t.descontoGeral > 0 ? (
              <tr>
                <td className="border border-black px-3 py-1">Desconto geral:</td>
                <td className="border border-black px-3 py-1 text-right">
                  - {brl(t.descontoGeral)}
                </td>
              </tr>
            ) : null}
            <tr className="font-bold">
              <td className="border border-black px-3 py-1">Total a pagar:</td>
              <td className="border border-black px-3 py-1 text-right">{brl(t.total)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <p className="mt-3 border border-black p-2 text-[10px]">
        <strong>Garantia:</strong> {os.garantiaDias} dias. {EMPRESA.textoGarantia}
      </p>

      <section className="mt-8 grid grid-cols-3 gap-4 text-center text-[10px]">
        <div className="border-t border-black pt-1">
          {EMPRESA.nome}
          <br />
          Empresa
        </div>
        <div className="border-t border-black pt-1">
          {EMPRESA.responsavelTecnico}
          <br />
          Responsável técnico
        </div>
        <div className="border-t border-black pt-1">
          {cliente?.nome ?? "Cliente"}
          <br />
          Cliente
        </div>
      </section>

      <p className="mt-4 text-center text-[9px]">
        {EMPRESA.nome} — documento gerado em {new Date().toLocaleString("pt-BR")}
      </p>
    </div>
  );
}
