/**
 * Script para criar usuários no Firebase Auth + Firestore.
 * 
 * Uso:
 *   node criar-usuario.mjs
 * 
 * Edite o array USUARIOS abaixo antes de rodar.
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const serviceAccount = JSON.parse(readFileSync("./serviceAccountKey.json", "utf8"));
initializeApp({ credential: cert(serviceAccount) });

const auth = getAuth();
const db = getFirestore();

/**
 * adicione quantos usuários precisar.
 * 
 * perfil: "admin" | "tecnico" | "administrativo" | "mecanico"
 */
const USUARIOS = [
  {
    nome: "Norton Goli",
    email: "nortongoli40@gmail.com",
    senha: "9.fWqqv1z@",
    perfil: "mecanico",
    perfilExibicao: "Mecânico",
  },
  {
    nome: "Jairo Alves de Oliveira",
    email: "oficinaidealjairo@gmail.com",
    senha: "iv5a.0%Sq",
    perfil: "admin",
    perfilExibicao: "Administrador",
  },
  // {
  //   nome: "Outro Funcionário",
  //   email: "outro@email.com.br",
  //   senha: "senha456",
  //   perfil: "administrativo",
  //   perfilExibicao: "Administrativo",
  // },
];

for (const u of USUARIOS) {
  try {
    // Tenta criar no Auth
    let userRecord;
    try {
      userRecord = await auth.createUser({
        email: u.email,
        password: u.senha,
        displayName: u.nome,
      });
      console.log(`✅ Auth criado: ${u.email} (uid: ${userRecord.uid})`);
    } catch (e) {
      if (e.code === "auth/email-already-exists") {
        userRecord = await auth.getUserByEmail(u.email);
        console.log(`⚠️  Auth já existe: ${u.email} (uid: ${userRecord.uid})`);
      } else {
        throw e;
      }
    }

    // Seta os custom claims
    await auth.setCustomUserClaims(userRecord.uid, {
      perfil: u.perfil,
      ativo: true,
    });
    console.log(`✅ Claims setados: perfil=${u.perfil}, ativo=true`);

    // Salva no Firestore (coleção usuarios)
    await db.collection("usuarios").doc(userRecord.uid).set({
      nome: u.nome,
      email: u.email,
      perfil: u.perfilExibicao,
      ativo: true,
      criadoEm: Timestamp.now(),
      atualizadoEm: Timestamp.now(),
      criadoPor: "sistema",
      atualizadoPor: "sistema",
    }, { merge: true });
    console.log(`✅ Firestore atualizado: /usuarios/${userRecord.uid}`);
    console.log("");

  } catch (e) {
    console.error(`❌ Erro em ${u.email}:`, e.message);
  }
}

console.log("Pronto! O usuário já pode fazer login no sistema.");
console.log("Lembre de comunicar o email e senha para a pessoa.");
