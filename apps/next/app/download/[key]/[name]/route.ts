import stream from "node:stream";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { notFound } from "next/navigation";
import { s3Client } from "@/trpc";
import env from "@/env";

export async function GET(_: Request, { params }: { params: Promise<{ key: string; name: string }> }) {
  const { key, name } = await params;
  const command = new GetObjectCommand({ Bucket: env.S3_PRIVATE_BUCKET, Key: key });
  const { Body } = await s3Client.send(command);
  if (!(Body instanceof stream.Readable)) notFound();
  return new Response(Body.transformToWebStream(), {
    headers: { "Content-Disposition": `attachment; filename="${name}"` },
  });
}
