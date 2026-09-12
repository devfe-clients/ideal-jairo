import type { ColecaoNome, DBAdapter, Registro } from "./types";
import { firebaseConfigurado } from "../firebaseConfig";

/**
 * ESTRUTURA PRONTA PARA O FIREBASE (ainda não ativada).
 *
 * Como ligar (sessão 2):
 * 1. O SDK web `firebase` já está instalado.
 * 2. Preencher as variáveis no Vercel / .env.local:
 *    VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID,
 *    VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID,
 *    VITE_FIREBASE_APP_ID e, opcionalmente, VITE_FIREBASE_MEASUREMENT_ID.
 * 3. Implementar cada operação com os serviços exportados por ../firebase.
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
