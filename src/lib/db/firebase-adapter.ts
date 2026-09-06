import type { ColecaoNome, DBAdapter, Registro } from "./types";

/**
 * ESTRUTURA PRONTA PARA O FIREBASE (ainda não ativada).
 *
 * Como ligar (sessão 2):
 * 1. `npm i firebase` (client) e `firebase-admin` (server functions)
 * 2. Preencher as variáveis no Vercel / .env:
 *    VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID,
 *    VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_APP_ID
 *    (servidor) FIREBASE_SERVICE_ACCOUNT  -> chave privada, NUNCA no frontend
 * 3. Descomentar a implementação abaixo e trocar o adaptador em src/lib/db/index.ts
 *
 * OTIMIZAÇÃO DE CUSTO (meta < R$ 20/mês):
 * - Firestore cobra por LEITURA de documento. Regra do projeto: nenhuma tela
 *   faz leitura em loop; usamos cache local + listeners apenas nas coleções
 *   abertas na tela (onSnapshot em query com limit/where, nunca coleção inteira).
 * - Documentos "gordos": a OS guarda itens e checklist embutidos (1 leitura por OS
 *   em vez de N leituras por item).
 * - Índices compostos apenas para as buscas usadas (placa, telefone, status, data).
 * - Fotos NUNCA no Firestore: só a URL. Ver src/lib/fotos.ts.
 */

export const firebaseConfig = {
  apiKey: import.meta.env["VITE_FIREBASE_API_KEY"] as string | undefined,
  authDomain: import.meta.env["VITE_FIREBASE_AUTH_DOMAIN"] as string | undefined,
  projectId: import.meta.env["VITE_FIREBASE_PROJECT_ID"] as string | undefined,
  storageBucket: import.meta.env["VITE_FIREBASE_STORAGE_BUCKET"] as string | undefined,
  appId: import.meta.env["VITE_FIREBASE_APP_ID"] as string | undefined,
};

export const firebaseConfigurado = Boolean(firebaseConfig.projectId && firebaseConfig.apiKey);

export const firebaseAdapter: DBAdapter = {
  nome: "firebase",
  async listar<T extends Registro>(_colecao: ColecaoNome): Promise<T[]> {
    throw new Error("Firebase ainda não conectado. Configure as chaves VITE_FIREBASE_*.");
  },
  async salvar<T extends Registro>(_colecao: ColecaoNome, _registro: T): Promise<T> {
    throw new Error("Firebase ainda não conectado.");
  },
  async remover() {
    throw new Error("Firebase ainda não conectado.");
  },
  observar() {
    return () => {};
  },
};
