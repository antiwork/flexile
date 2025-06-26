import { BuildingIcon } from "lucide-react";
import { redirect } from "next/navigation";

interface AcceptInvitationPageProps {
  params: { token: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function AcceptInvitationPage({ params }: AcceptInvitationPageProps) {
  const token = params.token;

  const onAcceptInvitation = async () => {
    "use server";
    redirect(`/signup?invite_link_token=${encodeURIComponent(token)}`);
  };

  return (
    <div className="bg-muted flex min-h-screen items-center justify-center">
      <div className="items-left flex w-full max-w-md flex-col rounded-xl bg-white p-8 shadow-lg">
        <div className="bg-muted mb-4 flex h-12 w-12 rounded-lg">
          <BuildingIcon className="m-auto h-12 w-12 text-gray-700" />
        </div>
        <div className="text-md mb-2 font-semibold">Sahil invited you to join Acme, Inc.</div>
        <div className="text-muted-foreground mb-6 text-sm">
          As a contractor, you’ll define your role, set your rate, and upload your contract. Let’s get started!
        </div>
        <form action={onAcceptInvitation}>
          <button
            className="w-full rounded-lg bg-black py-3 text-base font-medium text-white transition hover:bg-gray-900"
            type="submit"
          >
            Accept Invitation
          </button>
        </form>
      </div>
    </div>
  );
}
