export const firebaseConfig = {
  apiKey: import.meta.env["VITE_FIREBASE_API_KEY"] as string | undefined,
  authDomain: import.meta.env["VITE_FIREBASE_AUTH_DOMAIN"] as string | undefined,
  projectId: import.meta.env["VITE_FIREBASE_PROJECT_ID"] as string | undefined,
  storageBucket: import.meta.env["VITE_FIREBASE_STORAGE_BUCKET"] as string | undefined,
  messagingSenderId: import.meta.env["VITE_FIREBASE_MESSAGING_SENDER_ID"] as string | undefined,
  appId: import.meta.env["VITE_FIREBASE_APP_ID"] as string | undefined,
  measurementId: import.meta.env["VITE_FIREBASE_MEASUREMENT_ID"] as string | undefined,
};

const camposObrigatorios = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
] as const;

export const firebaseConfigurado = camposObrigatorios.every(
  (campo) => firebaseConfig[campo]?.trim(),
);

export function validarFirebaseConfig() {
  const ausentes = camposObrigatorios.filter((campo) => !firebaseConfig[campo]?.trim());
  if (ausentes.length > 0) {
    throw new Error(`Firebase não configurado. Variáveis ausentes: ${ausentes.join(", ")}.`);
  }
  return firebaseConfig;
}