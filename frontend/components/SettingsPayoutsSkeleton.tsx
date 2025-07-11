import { Card, CardContent, CardHeader, CardFooter, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCurrentUser } from "@/global";

export default function SettingsPayoutsSkeleton() {
  const user = useCurrentUser();

  return (
    <div className="grid gap-8">
      {user.roles.investor ? (
        <DividendSkeleton />
      ) : null}
      <BankAccountsSkeleton />
    </div>
  );
}

export const DividendSkeleton = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dividends</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4">
          <div className="space-y-2">
            <div className="h-4 w-48 bg-accent animate-pulse rounded-md" />
            <div className="h-10 w-full max-w-xs bg-accent animate-pulse rounded-md" />
            <div className="h-4 w-80 bg-accent animate-pulse rounded-md" />
          </div>
          <CardFooter className="justify-start p-0">
            <div className="h-10 w-28 bg-accent animate-pulse rounded-md" />
          </CardFooter>
        </form>
      </CardContent>
    </Card>
  );
};

export const BankAccountsSkeleton = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payout method</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between">
          <div>
            <div className="h-6 w-40 bg-accent animate-pulse rounded-md" />
            <div className="h-4 w-32 mt-1 bg-accent animate-pulse rounded-md" />
            <div className="flex flex-col pt-2">
              <div className="flex items-center">
                <div className="h-4 w-36 bg-accent animate-pulse rounded-md" />
              </div>
              <div className="flex items-center mt-1">
                <div className="h-4 w-40 bg-accent animate-pulse rounded-md" />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
          </div>
        </div>

        <Separator />

        <div className="flex justify-between">
          <div>
            <div className="h-6 w-36 bg-accent animate-pulse rounded-md" />
            <div className="h-4 w-28 mt-1 bg-accent animate-pulse rounded-md" />

          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="h-9 w-32 bg-accent animate-pulse rounded-md" />
          </div>
        </div>

        <Separator />

        <div>
          <div className="h-9 w-36 bg-accent animate-pulse rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
};
