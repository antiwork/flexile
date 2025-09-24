import { EnvelopeIcon } from "@heroicons/react/24/outline";
import { useMutation } from "@tanstack/react-query";
import MutationButton from "@/components/MutationButton";
import RichText from "@/components/RichText";
import SkeletonList from "@/components/SkeletonList";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import { request } from "@/utils/request";
import { send_test_email_company_company_update_url } from "@/utils/routes";

function ViewUpdateDialog({ updateId, onOpenChange }: { updateId: string; onOpenChange: () => void }) {
  const company = useCurrentCompany();
  const {
    data: update = { title: "", sentAt: null, body: "" },
    isLoading,
    isError,
  } = trpc.companyUpdates.get.useQuery({ companyId: company.id, id: updateId });

  const sendTestEmail = useMutation({
    mutationFn: async () => {
      await request({
        method: "POST",
        url: send_test_email_company_company_update_url(company.externalId, updateId),
        accept: "json",
        assertOk: true,
      });
    },
  });

  return (
    <Dialog defaultOpen onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {isLoading ? (
              <Skeleton className="h-7 max-w-80" />
            ) : isError ? (
              "Unable to load update"
            ) : (
              `${update.sentAt ? "" : "Previewing:"} ${update.title}`
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-8">
          {isLoading ? (
            <>
              <SkeletonList count={4}>
                <div className="flex flex-col gap-5">
                  <Skeleton className="h-6 max-w-60" />
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-3" />
                    <Skeleton className="h-3" />
                    <Skeleton className="h-3" />
                  </div>
                </div>
              </SkeletonList>
              <Skeleton className="h-4 max-w-40" />
            </>
          ) : isError ? (
            "Something went wrong. Please try again later."
          ) : (
            <>
              <RichText content={update.body} />
              <p>{company.primaryAdminName}</p>
            </>
          )}
        </div>
        {!isLoading && !isError && !update.sentAt && (
          <DialogFooter>
            <DialogClose asChild>
              <Button size="small" variant="outline">
                Close
              </Button>
            </DialogClose>
            <MutationButton size="small" loadingText="Sending..." mutation={sendTestEmail}>
              <EnvelopeIcon className="size-4" />
              Send test email
            </MutationButton>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ViewUpdateDialog;
