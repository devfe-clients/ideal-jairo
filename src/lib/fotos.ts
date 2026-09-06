/**
 * ESTRATÉGIA DE FOTOS (custo alvo: R$ 0 a R$ 5/mês)
 *
 * 1. Toda foto é comprimida no navegador ANTES de subir:
 *    - redimensionada para no máx. 1280px no maior lado
 *    - convertida para WebP com qualidade 0,72
 *    - resultado típico: 90 KB a 160 KB por foto (vs. 3-5 MB da câmera)
 *    Com 15 fotos por OS e 120 OS/mês => ~200 MB/mês.
 *
 * 2. Onde guardar (decidir na sessão 2):
 *    a) Cloudflare R2 — 10 GB grátis, SEM cobrança de saída. Recomendado: custo R$ 0.
 *    b) Firebase Storage — 5 GB grátis no Spark; no Blaze ~US$ 0,026/GB.
 *    c) Cloudinary Free — 25 créditos/mês, otimização automática.
 *    O Firestore guarda apenas a URL da foto, nunca o binário.
 *
 * Enquanto o storage não está conectado, a foto comprimida fica como dataURL
 * local (apenas para demonstração das telas).
 */

export const MAX_FOTOS = 15;

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

export function blobParaDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
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
