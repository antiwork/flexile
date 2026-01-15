import type { ReactNode } from "react";

// This layout makes GitHub callback pages public (no auth required)
// Users will be redirected here from GitHub OAuth/App installation
export default function GitHubLayout({ children }: { children: ReactNode }) {
  return children;
}
