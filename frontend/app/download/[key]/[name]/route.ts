import stream from "node:stream";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { notFound } from "next/navigation";
import env from "@/env";
import { s3Client } from "@/trpc";

export async function GET(_: Request, context: RouteContext<"/download/[key]/[name]">) {
  const { key, name } = await context.params;
  const command = new GetObjectCommand({ Bucket: env.S3_PRIVATE_BUCKET, Key: key });
  const { Body } = await s3Client.send(command);
  if (!(Body instanceof stream.Readable)) notFound();
  return new Response(Body.transformToWebStream(), {
    headers: { "Content-Disposition": `attachment; filename="${name}"` },
  });
}
