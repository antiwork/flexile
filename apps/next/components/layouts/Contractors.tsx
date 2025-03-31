import Link from "next/link";
import React from "react";

interface ContractorsLayoutProps {
  children: React.ReactNode;
}

export default function ContractorsLayout({ children }: ContractorsLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-100">
      <nav className="w-64 bg-white shadow-md">
        <div className="p-4">
          <h1 className="text-2xl font-bold text-blue-600">Flexile</h1>
        </div>
        <ul className="mt-4">
          <li>
            <Link href="/dashboard" className="block px-4 py-2 text-gray-700 hover:bg-blue-50">
              Dashboard
            </Link>
          </li>
          <li>
            <Link href="/contractors" className="block px-4 py-2 text-gray-700 hover:bg-blue-50">
              Contractors
            </Link>
          </li>
          <li>
            <Link href="/projects" className="block px-4 py-2 text-gray-700 hover:bg-blue-50">
              Projects
            </Link>
          </li>
          <li>
            <Link href="/settings" className="block px-4 py-2 text-gray-700 hover:bg-blue-50">
              Settings
            </Link>
          </li>
        </ul>
      </nav>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
