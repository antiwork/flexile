"use client";

import { Switch } from "@/components/ui/switch";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { trpc } from "@/trpc/client";
import { cn } from "@/utils";

export default function AdminsPage() {
  const company = useCurrentCompany();
  const currentUser = useCurrentUser();
  const { data: workers = [], isLoading } = trpc.contractors.list.useQuery({ 
    companyId: company.id 
  });

  const trpcUtils = trpc.useUtils();

  const toggleAdminMutation = trpc.companies.toggleAdminRole.useMutation({
    onSuccess: async () => {
      await trpcUtils.contractors.list.invalidate();
    },
    onError: (error) => {
      console.error("Failed to toggle admin role:", error.message);
    },
  });

  return (
    <div className="grid gap-8">
      <hgroup>
        <h2 className="mb-1 text-xl font-bold">Admins</h2>
        <p className="text-muted-foreground text-base">
          Manage administrator access for your workspace members.
        </p>
      </hgroup>

      <div className="rounded-lg border">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : workers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No team members found.</div>
        ) : (
          <div className="divide-y">
            {workers.map((worker) => {
              const isCurrentUserRow = currentUser.email === worker.user.email;
              const isLoadingToggle = 
                toggleAdminMutation.isPending && 
                toggleAdminMutation.variables?.userId === worker.user.id;
              
              return (
                <div 
                  key={worker.id} 
                  className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-muted/50"
                >
                  <div>
                    <div className="font-medium">{worker.user.name}</div>
                    <div className="text-sm text-muted-foreground">{worker.user.email}</div>
                  </div>
                  <Switch
                    checked={worker.user.isAdmin ?? false}
                    onCheckedChange={(checked) => {
                      if (isCurrentUserRow) return;
                      toggleAdminMutation.mutate({
                        companyId: company.id,
                        userId: worker.user.id,
                        isAdmin: checked,
                      });
                    }}
                    disabled={isCurrentUserRow || isLoadingToggle}
                    aria-label={`Toggle admin status for ${worker.user.name || worker.user.email}`}
                    className={cn(
                      isCurrentUserRow && "opacity-50 cursor-not-allowed",
                      isLoadingToggle && "opacity-70 pointer-events-none"
                    )}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}