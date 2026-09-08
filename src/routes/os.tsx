import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { ListaOS } from "@/components/ListaOS";

export const Route = createFileRoute("/os")({
  head: () => ({
    meta: [
      { title: "Ordens de serviço | Oficina Ideal Jairo" },
      {
        name: "description",
        content:
          "Controle das ordens de serviço da Oficina Ideal Jairo: status, peças, mão de obra e valores calculados automaticamente.",
      },
      { property: "og:title", content: "Ordens de serviço | Oficina Ideal Jairo" },
      { property: "og:description", content: "Abertura e acompanhamento de OS da oficina." },
    ],
  }),
  component: OSPage,
});

function OSPage() {
  return (
    <AppLayout titulo="Ordens de serviço" descricao="Da abertura à entrega do veículo">
      <ListaOS tipo="os" />
    </AppLayout>
  );
}
