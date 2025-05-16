import React, { type ReactNode } from "react";

const Placeholder = ({ icon: Icon, children }: { icon?: React.ElementType; children: ReactNode }) => (
  <div className="grid justify-items-center gap-4 rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-600">
    {Icon ? <Icon className="-mb-1 size-6 text-gray-600" aria-hidden="true" /> : null}
    {children}
  </div>
);

export default Placeholder;
