import { Fragment, type ReactNode } from "react";

function SkeletonList({ count = 3, children }: { count?: number; children: ReactNode }) {
  return Array.from({ length: count }).map((_, i) => <Fragment key={i}>{children}</Fragment>);
}

export default SkeletonList;
