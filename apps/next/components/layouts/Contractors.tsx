import Link from "next/link";
import React from "react";

// Define navigation items for better maintainability and scalability
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/contractors", label: "Contractors" },
  { href: "/projects", label: "Projects" },
  { href: "/settings", label: "Settings" },
] as const;

// Sidebar component
const Sidebar = () => (
  <nav className="w-64 bg-white shadow-md">
    <div className="p-4">
      <h1 className="text-2xl font-bold text-blue-600">Flexile</h1>
    </div>
    <ul className="mt-4">
      {NAV_ITEMS.map((item) => (
        <li key={item.href}>
          <Link href={item.href} className="block px-4 py-2 text-gray-700 hover:bg-blue-50">
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  </nav>
);

interface ContractorsLayoutProps {
  children: React.ReactNode;
}

export default function ContractorsLayout({ children }: ContractorsLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
