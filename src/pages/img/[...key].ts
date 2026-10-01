import type { APIRoute } from "astro";
import { getObject } from "@/lib/s3";
import { requiredEnv } from "@/lib/env";

/** Serves show images from our own S3 bucket so the browser never hits the source sites. */
export const GET: APIRoute = async ({ params }) => {
  const key = params.key;
  if (!key?.startsWith("shows/")) return new Response("Not found", { status: 404 });

  try {
    const object = await getObject(`${requiredEnv("S3_FOLDER")}/${key}`);
    return new Response(object.Body!.transformToWebStream(), {
      headers: {
        "content-type": object.ContentType ?? "application/octet-stream",
        "cache-control": "public, max-age=86400",
      },
    });
  } catch (err: any) {
    if (err?.name === "NoSuchKey") return new Response("Not found", { status: 404 });
    throw err;
  }
};
