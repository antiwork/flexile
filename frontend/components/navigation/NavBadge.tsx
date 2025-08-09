import { Badge } from "@/components/ui/badge";

export const NavBadge = ({ count }: { count: number }) => (
  <Badge role="status" className="ml-auto h-4 w-auto min-w-4 bg-blue-500 px-1 text-xs text-white">
    {count > 10 ? "10+" : count}
  </Badge>
);
