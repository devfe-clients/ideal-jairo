import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "fs";

const serviceAccount = JSON.parse(readFileSync("./serviceAccountKey.json", "utf8"));

initializeApp({ credential: cert(serviceAccount) });

const auth = getAuth();

const usuarios = [
  {
    email: "flyhigh.pedidos@gmail.com",
    nome: "FlyHigh Tech",
    perfil: "admin",
  },
  {
    email: "oficinaidealjairo@gmail.com",
    nome: "Jairo Alves de Oliveira",
    perfil: "admin",
  },
];

for (const u of usuarios) {
  try {
    const user = await auth.getUserByEmail(u.email);
    await auth.setCustomUserClaims(user.uid, { perfil: u.perfil, ativo: true });
    console.log(`✅ ${u.email} → perfil=${u.perfil}, ativo=true`);
  } catch (e) {
    console.error(`❌ ${u.email}:`, e.message);
  }
}

console.log("\nPronto! Faça logout/login no sistema para os claims entrarem em vigor.");
