import { createServerFn } from "@tanstack/react-start";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const endpoint = process.env["R2_ENDPOINT"] ?? process.env["VITE_R2_ENDPOINT"] ?? "";

const r2 = new S3Client({
  region: "auto",
  endpoint,
  credentials: {
    accessKeyId: process.env["R2_ACCESS_KEY_ID"] ?? "",
    secretAccessKey: process.env["R2_SECRET_ACCESS_KEY"] ?? "",
  },
});

const BUCKET = process.env["VITE_R2_BUCKET"] ?? "ideal-jairo-fotos";

/**
 *gera uma URL pré-assinada para upload direto do browser para o R2.
 *a key nunca sai do servidor.
 */
export const gerarUrlUpload = createServerFn({ method: "POST" })
  .validator((data: { chave: string; tipo: string }) => data)
  .handler(async ({ data }) => {
    const cmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: data.chave,
      ContentType: data.tipo,
    });
    const url = await getSignedUrl(r2, cmd, { expiresIn: 300 }); // 5 min
    return { url, chave: data.chave };
  });
