import { createFileRoute, Link } from "@tanstack/react-router";
const logo = { url: "/logo-ideal-jairo.jpg" };

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso | Oficina Ideal Jairo" },
      {
        name: "description",
        content:
          "Termos e condições de uso do portal de agendamento online da Oficina Ideal Jairo em Praia Grande/SP.",
      },
    ],
  }),
  component: Termos,
});

function Termos() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <img src={logo.url} alt="Ideal Jairo" className="h-10 w-10 rounded-md object-cover" />
          <div>
            <p className="font-display text-base font-bold">Oficina Ideal Jairo</p>
            <p className="text-xs text-muted-foreground">Praia Grande / SP</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 space-y-8 text-sm leading-relaxed text-foreground">
        <div>
          <h1 className="font-display text-2xl font-bold mb-1">Termos de Uso</h1>
          <p className="text-xs text-muted-foreground">Última atualização: setembro de 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="font-semibold text-base">1. Partes</h2>
          <p>
            Estes Termos de Uso regulam o acesso e uso do portal de agendamento online da{" "}
            <strong>Oficina Ideal Jairo</strong>, CNPJ 58.623.937/0001-01, Praia Grande/SP
            (doravante "Oficina"), por qualquer pessoa que utilize o portal (doravante "Usuário").
          </p>
          <p>
            Ao utilizar o portal, o Usuário declara ter lido, compreendido e concordado
            integralmente com estes Termos.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-base">2. Objeto</h2>
          <p>
            O portal tem por finalidade exclusiva permitir que o Usuário realize o agendamento
            online de serviços mecânicos automotivos prestados pela Oficina, consulte o histórico
            de seus agendamentos e cancele horários previamente marcados.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-base">3. Acesso e autenticação</h2>
          <p>
            O acesso ao portal é feito mediante autenticação com conta Google. O Usuário é
            responsável pela segurança de suas credenciais e por todas as ações realizadas em sua
            conta. Em caso de uso não autorizado, o Usuário deve comunicar a Oficina imediatamente
            pelo WhatsApp <strong>(13) 98867-3809</strong>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-base">4. Agendamento</h2>
          <p>
            O agendamento realizado pelo portal é uma <strong>solicitação sujeita a confirmação</strong>{" "}
            pela Oficina. A confirmação será feita por WhatsApp ou telefone. A Oficina reserva-se o
            direito de reagendar ou recusar um horário por motivo operacional, comunicando o
            Usuário com antecedência razoável.
          </p>
          <p>
            Horários disponíveis no portal refletem a agenda em tempo real. A Oficina não se
            responsabiliza por atrasos decorrentes de condições alheias ao seu controle
            (fornecimento de peças, condições do veículo, etc.).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-base">5. Cancelamento</h2>
          <p>
            O Usuário pode cancelar um agendamento diretamente pelo portal enquanto o status for
            "Pendente" ou "Confirmado" e a data não tiver passado. Cancelamentos com menos de{" "}
            <strong>2 horas de antecedência</strong> podem sujeitar o Usuário à perda de
            prioridade em novos agendamentos, a critério da Oficina.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-base">6. Responsabilidades do Usuário</h2>
          <p>O Usuário compromete-se a:</p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Fornecer informações verdadeiras, precisas e atualizadas no cadastro</li>
            <li>Comparecer no horário agendado ou cancelar com antecedência</li>
            <li>Não utilizar o portal para fins ilícitos ou que prejudiquem terceiros</li>
            <li>Não tentar burlar sistemas de segurança ou limites de agendamento</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-base">7. Limitação de responsabilidade</h2>
          <p>
            A Oficina não se responsabiliza por danos indiretos decorrentes do uso do portal,
            incluindo, sem limitação, perda de dados por falhas de conectividade, interrupções de
            serviços de terceiros (Google Firebase, Cloudflare) ou força maior.
          </p>
          <p>
            O portal é fornecido "no estado em que se encontra". A Oficina envidará seus melhores
            esforços para mantê-lo disponível, mas não garante disponibilidade ininterrupta.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-base">8. Propriedade intelectual</h2>
          <p>
            O portal, sua identidade visual, logotipo e conteúdos são de titularidade exclusiva da
            Oficina Ideal Jairo. É proibida qualquer reprodução, distribuição ou uso não autorizado.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-base">9. Privacidade e LGPD</h2>
          <p>
            O tratamento de dados pessoais é regido pela nossa{" "}
            <Link to="/privacidade" className="underline underline-offset-2 hover:text-primary transition-colors">
              Política de Privacidade
            </Link>
            , em conformidade com a Lei nº 13.709/2018 (LGPD). Ao usar o portal, o Usuário
            consente com o tratamento descrito nessa política.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-base">10. Alterações nos termos</h2>
          <p>
            A Oficina pode atualizar estes Termos a qualquer momento. O uso continuado do portal
            após a publicação de novos Termos constitui aceitação das alterações. Mudanças
            relevantes serão comunicadas pelo WhatsApp.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-base">11. Foro e legislação aplicável</h2>
          <p>
            Estes Termos são regidos pela legislação brasileira. Eventuais conflitos serão
            submetidos ao foro da comarca de <strong>Praia Grande/SP</strong>, com renúncia a
            qualquer outro, por mais privilegiado que seja.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-base">12. Contato</h2>
          <p>
            Oficina Ideal Jairo — CNPJ 58.623.937/0001-01 — Praia Grande/SP
            <br />
            WhatsApp: <strong>(13) 98867-3809</strong>
          </p>
        </section>
      </main>

      <footer className="border-t border-border mt-10">
        <div className="mx-auto max-w-3xl px-4 py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Oficina Ideal Jairo — CNPJ 58.623.937/0001-01</span>
          <div className="flex gap-4">
            <Link to="/privacidade" className="hover:text-foreground transition-colors">Privacidade</Link>
            <Link to="/termos" className="hover:text-foreground transition-colors">Termos de uso</Link>
            <Link to="/agendar" className="hover:text-foreground transition-colors">Agendar serviço</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
