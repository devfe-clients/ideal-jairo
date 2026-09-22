import { createFileRoute, Link } from "@tanstack/react-router";
const logo = { url: "/logo-ideal-jairo.jpg" };

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade | Oficina Ideal Jairo" },
      {
        name: "description",
        content:
          "Saiba como a Oficina Ideal Jairo coleta, usa e protege seus dados pessoais, conforme a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018).",
      },
    ],
  }),
  component: Privacidade,
});

function Privacidade() {
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
          <h1 className="font-display text-2xl font-bold mb-1">Política de Privacidade</h1>
          <p className="text-xs text-muted-foreground">Última atualização: setembro de 2025</p>
        </div>

        <section className="space-y-3">
          <h2 className="font-semibold text-base">1. Identificação do controlador</h2>
          <p>
            Esta Política de Privacidade é aplicada pela <strong>Oficina Ideal Jairo</strong>,
            pessoa jurídica de direito privado, inscrita no CNPJ sob o nº{" "}
            <strong>58.623.937/0001-01</strong>, com sede em Praia Grande/SP, doravante denominada
            simplesmente "Oficina".
          </p>
          <p>
            Encarregado de dados (DPO) — para exercer seus direitos ou tirar dúvidas, entre em
            contato pelo WhatsApp <strong>(13) 98867-3809</strong>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-base">2. Legislação aplicável</h2>
          <p>
            Esta política está em conformidade com a <strong>Lei Geral de Proteção de Dados
            Pessoais (LGPD — Lei nº 13.709/2018)</strong> e demais normas brasileiras aplicáveis.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-base">3. Dados coletados</h2>
          <p>Coletamos apenas os dados necessários para prestar nossos serviços:</p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Nome completo</li>
            <li>CPF ou CNPJ (opcional)</li>
            <li>Telefone / WhatsApp</li>
            <li>E-mail</li>
            <li>Endereço</li>
            <li>Dados do veículo (placa, marca, modelo, ano, quilometragem)</li>
            <li>Informações sobre o serviço solicitado</li>
            <li>Conta Google (quando utilizada para login no portal de agendamento)</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-base">4. Finalidade do tratamento</h2>
          <p>Seus dados são utilizados exclusivamente para:</p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Agendamento e confirmação de serviços mecânicos</li>
            <li>Emissão de ordens de serviço e orçamentos</li>
            <li>Contato por WhatsApp ou telefone sobre o andamento do serviço</li>
            <li>Histórico de atendimentos e veículos do cliente</li>
            <li>Cumprimento de obrigações legais (notas fiscais, garantias)</li>
          </ul>
          <p>
            Não utilizamos seus dados para envio de publicidade não solicitada nem os
            compartilhamos com terceiros para fins comerciais.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-base">5. Base legal</h2>
          <p>
            O tratamento é realizado com base no <strong>consentimento</strong> do titular (art. 7º,
            I, LGPD), na <strong>execução de contrato</strong> (art. 7º, V) e no{" "}
            <strong>legítimo interesse</strong> da Oficina (art. 7º, IX), sempre limitado ao
            mínimo necessário para a finalidade informada.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-base">6. Armazenamento e segurança</h2>
          <p>
            Os dados são armazenados de forma segura na plataforma{" "}
            <strong>Firebase (Google Cloud)</strong>, com controles de acesso por perfil de usuário,
            registro de auditoria de todas as alterações e comunicação criptografada (HTTPS/TLS).
            Fotos e arquivos são armazenados no serviço <strong>Cloudflare R2</strong>, com acesso
            restrito e criptografia em repouso.
          </p>
          <p>
            O acesso interno ao sistema é protegido por autenticação Firebase Auth e regras de
            segurança no Firestore, garantindo que apenas funcionários autorizados visualizem os
            dados.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-base">7. Prazo de retenção</h2>
          <p>
            Mantemos seus dados enquanto necessário para a prestação dos serviços e cumprimento de
            obrigações legais (em geral, 5 anos para fins fiscais). Após esse prazo, os dados são
            anonimizados ou excluídos.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-base">8. Seus direitos (LGPD, art. 18)</h2>
          <p>Você tem direito a:</p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Confirmação da existência de tratamento dos seus dados</li>
            <li>Acesso aos seus dados</li>
            <li>Correção de dados incompletos, inexatos ou desatualizados</li>
            <li>Anonimização, bloqueio ou eliminação de dados desnecessários</li>
            <li>Portabilidade dos dados</li>
            <li>Revogação do consentimento a qualquer momento</li>
            <li>Informação sobre compartilhamento com terceiros</li>
          </ul>
          <p>
            Para exercer qualquer um desses direitos, entre em contato pelo WhatsApp{" "}
            <strong>(13) 98867-3809</strong>. Responderemos em até 15 dias úteis.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-base">9. Cookies e tecnologias similares</h2>
          <p>
            O portal de agendamento pode utilizar cookies de sessão e armazenamento local apenas
            para manter o estado da autenticação Google e a experiência de navegação. Nenhum cookie
            de rastreamento ou publicidade é utilizado.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-base">10. Alterações nesta política</h2>
          <p>
            Esta política pode ser atualizada a qualquer momento. Alterações relevantes serão
            comunicadas pelo WhatsApp ou no portal de agendamento. Recomendamos consultar esta
            página periodicamente.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-base">11. Contato</h2>
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
