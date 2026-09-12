import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const serviceAccount = JSON.parse(readFileSync("./serviceAccountKey.json", "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── Configuração padrão da oficina ──────────────────────────────────────────
await db.collection("configuracoes").doc("principal").set({
  diasAtendimento: [1, 2, 3, 4, 5, 6], // seg a sáb
  horaInicio: "08:00",
  horaFim: "18:00",
  intervaloMinutos: 60,
  limitePorHorario: 2,
  diasBloqueados: [],
  servicos: [
    "Troca de óleo e filtro",
    "Alinhamento e balanceamento",
    "Freios (pastilhas/discos)",
    "Suspensão e amortecedor",
    "Troca de correia dentada",
    "Elétrica automotiva",
    "Ar condicionado",
    "Troca de rolamento",
    "Revisão geral",
    "Diagnóstico eletrônico",
    "Injeção eletrônica",
    "Embreagem",
    "Câmbio",
    "Escapamento",
    "Outro / não sei informar",
  ],
  criadoEm: Timestamp.now(),
  atualizadoEm: Timestamp.now(),
});
console.log("✅ configuracoes/principal criado");

// ── Serviços base (tabela de preços) ────────────────────────────────────────
const servicos = [
  { nome: "Troca de óleo e filtro",        valorPadrao: 80,  tempoEstimado: 0.5 },
  { nome: "Alinhamento e balanceamento",   valorPadrao: 120, tempoEstimado: 1   },
  { nome: "Freios (pastilhas/discos)",     valorPadrao: 150, tempoEstimado: 2   },
  { nome: "Suspensão e amortecedor",       valorPadrao: 200, tempoEstimado: 3   },
  { nome: "Troca de correia dentada",      valorPadrao: 250, tempoEstimado: 3   },
  { nome: "Elétrica automotiva",           valorPadrao: 120, tempoEstimado: 2   },
  { nome: "Ar condicionado",               valorPadrao: 180, tempoEstimado: 2   },
  { nome: "Troca de rolamento",            valorPadrao: 150, tempoEstimado: 2   },
  { nome: "Revisão geral",                 valorPadrao: 300, tempoEstimado: 4   },
  { nome: "Diagnóstico eletrônico",        valorPadrao: 100, tempoEstimado: 1   },
  { nome: "Injeção eletrônica",            valorPadrao: 200, tempoEstimado: 2   },
  { nome: "Embreagem",                     valorPadrao: 350, tempoEstimado: 4   },
  { nome: "Câmbio",                        valorPadrao: 400, tempoEstimado: 5   },
  { nome: "Escapamento",                   valorPadrao: 180, tempoEstimado: 2   },
];

const batch = db.batch();
for (const s of servicos) {
  const ref = db.collection("estoque").doc();
  batch.set(ref, {
    ...s,
    tipo: "servico",
    custo: 0,
    precoVenda: s.valorPadrao,
    quantidade: 999,
    estoqueMinimo: 0,
    criadoEm: Timestamp.now(),
    atualizadoEm: Timestamp.now(),
  });
}
await batch.commit();
console.log(`✅ ${servicos.length} serviços criados em /estoque`);

console.log("\nPronto! Recarregue o sistema.");
