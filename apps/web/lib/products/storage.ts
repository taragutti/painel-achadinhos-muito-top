import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { SafeHttpClient, validateImageSignature } from "@achadinhos/providers";

const allowedFormats = new Set(["jpeg", "png", "webp", "avif"]);

export async function storeUploadedImage(file: File) {
  const maxBytes = getMaxBytes();
  if (file.size <= 0 || file.size > maxBytes) throw new Error("IMAGE_SIZE_INVALID");
  const buffer = Buffer.from(await file.arrayBuffer());
  validateImageSignature(buffer, file.name);
  return storeImageBuffer(buffer);
}

export async function storeRemoteImage(rawUrl: string) {
  const response = await new SafeHttpClient({ maxResponseBytes: getMaxBytes() }).get(new URL(rawUrl));
  const buffer = Buffer.from(response.body);
  validateImageSignature(buffer);
  return storeImageBuffer(buffer);
}

async function storeImageBuffer(buffer: Buffer) {
  const image = sharp(buffer, { failOn: "error", limitInputPixels: 40_000_000 });
  const metadata = await image.metadata();
  if (!metadata.format || !allowedFormats.has(metadata.format)) throw new Error("IMAGE_FORMAT_INVALID");
  const id = randomUUID();
  const directory = uploadDirectory();
  await mkdir(directory, { recursive: true, mode: 0o750 });
  const fullName = `${id}.webp`;
  const thumbnailName = `${id}-thumb.webp`;
  await Promise.all([
    sharp(buffer).rotate().resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true }).webp({ quality: 86 }).toFile(resolve(directory, fullName)),
    sharp(buffer).rotate().resize(320, 320, { fit: "cover" }).webp({ quality: 78 }).toFile(resolve(directory, thumbnailName)),
  ]);
  const baseUrl = new URL(process.env.APP_URL ?? "http://localhost:3000");
  return { storedImageUrl: new URL(`/api/media/${fullName}`, baseUrl).href, thumbnailImageUrl: new URL(`/api/media/${thumbnailName}`, baseUrl).href };
}

export async function readStoredImage(filename: string) {
  if (!/^[0-9a-f-]{36}(?:-thumb)?\.webp$/.test(filename)) throw new Error("IMAGE_NOT_FOUND");
  return readFile(resolve(uploadDirectory(), filename));
}

function uploadDirectory() { return resolve(process.cwd(), "../../var/product-images"); }
function getMaxBytes() { return Math.min(Number(process.env.PRODUCT_IMAGE_MAX_BYTES ?? 5_242_880), 10_485_760); }
