import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { ListaOS } from "@/components/ListaOS";

export const Route = createFileRoute("/orcamentos")({
  head: () => ({
    meta: [
      { title: "Orçamentos | Oficina Ideal Jairo" },
      {
        name: "description",
        content:
          "Orçamentos da Oficina Ideal Jairo com aprovação total ou parcial pelo cliente e envio por WhatsApp.",
      },
      { property: "og:title", content: "Orçamentos | Oficina Ideal Jairo" },
      { property: "og:description", content: "Orçamentos, aprovação e conversão em OS." },
    ],
  }),
  component: OrcamentosPage,
});

function OrcamentosPage() {
  return (
    <AppLayout
      titulo="Orçamentos"
      descricao="Aprovação total ou parcial e conversão em OS com um clique"
    >
      <ListaOS tipo="orcamento" />
    </AppLayout>
  );
}
