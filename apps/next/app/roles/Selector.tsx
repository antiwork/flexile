import React, { useState } from "react";
import Select from "@/components/Select";
import { Button } from "@/components/ui/button";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import ManageModal from "./ManageModal";

const Selector = ({ value, onChange }: { value: string | null; onChange: (id: string) => void }) => {
  const company = useCurrentCompany();
  const [roles] = trpc.roles.list.useSuspenseQuery({ companyId: company.id });
  const [creatingRole, setCreatingRole] = useState(false);

  return (
    <>
      <Select
        value={value ?? undefined}
        onChange={onChange}
        options={roles.map((role) => ({ value: role.id, label: role.name }))}
        label={
          <div className="flex justify-between">
            Role
            <Button variant="link" onClick={() => setCreatingRole(true)}>
              Create new
            </Button>
          </div>
        }
      />
      {creatingRole ? <ManageModal open onClose={() => setCreatingRole(false)} id={null} onCreated={onChange} /> : null}
    </>
  );
};

export default Selector;
