import { Head, Html, Tailwind } from "@react-email/components";
import React from "react";

export default function EmailLayout({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <Html lang="en">
      <Head>
        <meta name="viewport" content="initial-scale = 1.0" />
      </Head>
      <Tailwind>
        <div className="font-sans">
          <div className="border-muted mx-auto my-8 max-w-xl rounded-lg border border-solid p-8">{children}</div>
          <footer className="mt-8 w-full p-4 text-center text-sm text-gray-600">
            {footer}
            548 Market Street, San Francisco, CA 94104-5401
          </footer>
        </div>
      </Tailwind>
    </Html>
  );
}
