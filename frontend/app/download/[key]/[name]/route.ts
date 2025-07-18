import stream from "node:stream";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { notFound } from "next/navigation";
import env from "@/env";
import { s3Client } from "@/trpc";

export async function GET(request: Request, { params }: { params: Promise<{ key: string; name: string }> }) {
  const { key, name } = await params;
  const url = new URL(request.url);
  const inline = url.searchParams.get("inline") === "true";

  const command = new GetObjectCommand({ Bucket: env.S3_PRIVATE_BUCKET, Key: key });
  const { Body } = await s3Client.send(command);
  if (!(Body instanceof stream.Readable)) notFound();

  const disposition = inline ? "inline" : "attachment";
  return new Response(Body.transformToWebStream(), {
    headers: { "Content-Disposition": `${disposition}; filename="${name}"` },
  });
}
