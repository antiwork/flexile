import { ErrorPage } from "@/app/error";

export const dynamic = "force-dynamic"; // work around a Next issue

export default function NotFound() {
  return <ErrorPage code={404} />;
}
