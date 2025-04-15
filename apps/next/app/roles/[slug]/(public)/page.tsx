"use client";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import SimpleLayout from "@/components/layouts/Simple";
import Placeholder from "@/components/Placeholder";
import { CardLink } from "@/components/ui/card-link";
import logo from "@/images/flexile-logo.svg";
import { trpc } from "@/trpc/client";
import { toSlug } from "@/utils";

export default function RolesPage() {
  const { slug } = useParams<{ slug: string }>();
  const [companySlug, companyId] = slug.split(/-(?=[^-]*$)/u);
  if (!companySlug || !companyId) notFound();
  const [company] = trpc.companies.publicInfo.useSuspenseQuery({ companyId });
  const [roles] = trpc.roles.public.list.useSuspenseQuery({ companyId });

  return (
    <SimpleLayout
      hideHeader
      title={
        <div className="flex flex-col items-center gap-4">
          <Image src={company.logoUrl ?? ""} className="size-12 rounded-md" width={48} height={48} alt="" />
          <div>Job openings at {company.name}</div>
        </div>
      }
    >
      <title>{`Open roles at ${company.name}`}</title>
      {roles.map((role) => (
        <CardLink key={role.id} href={`/roles/${companySlug}/${toSlug(role.name)}-${role.id}`} title={role.name} />
      ))}
      {!roles.length && (
        <Placeholder>
          <InformationCircleIcon />
          No open roles right now. Check back later!
        </Placeholder>
      )}
      <div className="flex items-center justify-center gap-2 uppercase">
        <div className="text-xs text-gray-500">Powered by</div>
        <Link href="https://flexile.com/">
          <Image src={logo} alt="Flexile" className="w-16" />
        </Link>
      </div>
    </SimpleLayout>
  );
}
