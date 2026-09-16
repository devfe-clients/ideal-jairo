/**
 * ESTRATÉGIA DE FOTOS — Cloudflare R2
 *
 * Fluxo:
 * 1.foto é comprimida no browser (WebP, ~120 KB)
 * 2.browser pede URL pré-assinada ao servidor (server function)
 * 3.browser faz PUT direto para o R2 com a URL pré-assinada
 * 4.url pública da foto é salva no Firestore (nunca o binário)
 *
 *custo estimado para 4.500 fotos/mês (~540 MB): R$ 0 (dentro do plano gratuito).
 */

import { gerarUrlUpload } from "./r2.server";

export const MAX_FOTOS = 15;

const ACCOUNT_ID = import.meta.env["VITE_R2_ACCOUNT_ID"] ?? "";
const PUBLIC_URL = import.meta.env["VITE_R2_PUBLIC_URL"] ?? "";

/** URL pública de uma foto armazenada no R2 */
function urlPublica(chave: string): string {
  return `${PUBLIC_URL}/${chave}`;
}

/**
 *comprime a foto no browser antes de subir.
 *resultado típico: 90–160 KB por foto.
 */
export async function comprimirFoto(file: File, maxLado = 1280, qualidade = 0.72) {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao comprimir"))),
      "image/webp",
      qualidade,
    ),
  );
  return { blob, tamanhoKb: Math.round(blob.size / 1024) };
}

/**
 * Faz upload da foto comprimida para o R2 e retorna a URL pública.
 * Se o R2 não estiver configurado, retorna dataURL local (fallback).
 */
export async function uploadFoto(
  blob: Blob,
  osId: string,
  index: number,
): Promise<string> {
  // Fallback: sem credenciais R2, salva como dataURL local
  if (!ACCOUNT_ID) {
    return blobParaDataUrl(blob);
  }

  try {
    const chave = `os/${osId}/${Date.now()}-${index}.webp`;
    const { url } = await gerarUrlUpload({ data: { chave, tipo: "image/webp" } });

    const res = await fetch(url, {
      method: "PUT",
      body: blob,
      headers: { "Content-Type": "image/webp" },
    });

    if (!res.ok) throw new Error(`Upload falhou: ${res.status}`);

    return urlPublica(chave);
  } catch (err) {
    console.error("Erro no upload R2, usando fallback local:", err);
    return blobParaDataUrl(blob);
  }
}

export function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao ler imagem"));
    reader.readAsDataURL(blob);
  });
}

export const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export function validarArquivoFoto(file: File) {
  if (!TIPOS_ACEITOS.includes(file.type)) return "Formato não suportado (use JPG, PNG ou WebP)";
  if (file.size > 20 * 1024 * 1024) return "Arquivo maior que 20 MB";
  return null;
}