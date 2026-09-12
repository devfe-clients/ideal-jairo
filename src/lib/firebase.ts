import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { firebaseConfig, firebaseConfigurado, validarFirebaseConfig } from "./firebaseConfig";

/**
 * Serviços do cliente Firebase. Permanecem nulos no servidor e enquanto as
 * variáveis não estiverem preenchidas, preservando o modo demonstrativo local.
 */
export const firebaseApp: FirebaseApp | null =
  firebaseConfigurado && typeof window !== "undefined"
    ? getApps().length > 0
      ? getApp()
      : initializeApp(validarFirebaseConfig())
    : null;

export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;
export const firestore: Firestore | null = firebaseApp ? getFirestore(firebaseApp) : null;
export const storage: FirebaseStorage | null = firebaseApp ? getStorage(firebaseApp) : null;

export { firebaseConfig, firebaseConfigurado };