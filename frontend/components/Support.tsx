import { HelperClientProvider, useUnreadConversationsCount } from "@helperai/react";
import { useHelperSession } from "@/app/(dashboard)/support/SupportPortal";
import { NavBadge } from "@/components/navigation/NavBadge";

const SupportUnreadCount = () => {
  const { data } = useUnreadConversationsCount();
  return data?.count && data.count > 0 ? <NavBadge count={data.count} /> : null;
};

export const SupportBadge = () => {
  const { data: helperSession } = useHelperSession();
  if (!helperSession) return null;

  return (
    <HelperClientProvider host="https://help.flexile.com" session={helperSession}>
      <SupportUnreadCount />
    </HelperClientProvider>
  );
};
