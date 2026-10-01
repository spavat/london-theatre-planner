import sharp from "sharp";
import { putObject } from "@/lib/s3";
import { fetchWithRetry } from "./http";

/** Re-encodes any image sharp can read as AVIF. Throws on data that isn't an image. */
export async function toAvif(input: Uint8Array): Promise<Uint8Array> {
  return sharp(input).avif({ quality: 80 }).toBuffer();
}

/** Downloads a show image, converts it to AVIF and stores it in S3. Returns the object key. */
export async function storeShowImage(slug: string, imageUrl: string): Promise<string> {
  const res = await fetchWithRetry(imageUrl);
  const key = `shows/${slug}.avif`;
  await putObject(key, await toAvif(new Uint8Array(await res.arrayBuffer())), "image/avif");
  return key;
}
