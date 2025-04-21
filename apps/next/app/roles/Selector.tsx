import React, { useId, useState } from "react";
import ComboBox from "@/components/ComboBox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";
import ManageModal from "./ManageModal";

const Selector = ({ value, onChange }: { value: string | null; onChange: (id: string) => void }) => {
  const company = useCurrentCompany();
  const [roles] = trpc.roles.list.useSuspenseQuery({ companyId: company.id });
  const [creatingRole, setCreatingRole] = useState(false);
  const uid = useId();

  return (
    <>
      <Label htmlFor={`role-${uid}`} className="flex items-center justify-between">
        Role
        <Button variant="link" onClick={() => setCreatingRole(true)}>
          Create new
        </Button>
      </Label>
      <ComboBox
        id={`role-${uid}`}
        value={value}
        onChange={onChange}
        options={roles.map((role) => ({ value: role.id, label: role.name }))}
      />
      {creatingRole ? <ManageModal open onClose={() => setCreatingRole(false)} id={null} onCreated={onChange} /> : null}
    </>
  );
};

export default Selector;
