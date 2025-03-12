"use client";

import { useMemo } from "react";
import MainLayout from "@/components/layouts/Main";
import Tabs from "@/components/Tabs";
import { useCurrentUser } from "@/global";

const DocumentsLayout = ({
  headerActions,
  children,
}: {
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}) => {
  const user = useCurrentUser();
  const showDocumentTemplates = useMemo(
    () => user.activeRole === "administrator" || user.activeRole === "lawyer",
    [user.activeRole],
  );

  return (
    <MainLayout title="Documents" headerActions={headerActions}>
      {showDocumentTemplates ? (
        <Tabs
          links={[
            { label: "Signatures", route: "/documents" },
            { label: "Templates", route: "/document_templates" },
          ]}
        />
      ) : null}
      {children}
    </MainLayout>
  );
};

export default DocumentsLayout;
