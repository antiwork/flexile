import { DocusealForm } from "@docuseal/react";
import type React from "react";
import { useCurrentUser } from "@/global";

export default function Form(props: Omit<React.ComponentProps<typeof DocusealForm>, "customCss" | "email">) {
  const user = useCurrentUser();

  // Consolidate common styles for both buttons
  const customCss = `
    #expand_form_button,
    #submit_form_button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem 0.75rem; /* py-2 px-3 */
      border-width: 1px;
      border-radius: 0.5rem; /* rounded-lg */
      gap: 0.375rem; /* gap-1.5 */
      white-space: nowrap;
      cursor: pointer;
      background-color: black;
      color: white;
      border-color: black;
      transition: background-color 0.2s ease-in-out, border-color 0.2s ease-in-out;
    }

    /* Unique styles for expand button */
    #expand_form_button {
      width: 100% !important;
      margin-left: 0 !important;
      margin-bottom: 0 !important;
    }

    #expand_form_button:hover,
    #submit_form_button:hover {
      background-color: #1f2937; /* gray-800 */
      border-color: #1f2937; /* gray-800 */
    }

    #expand_form_button:disabled,
    #submit_form_button:disabled {
      opacity: 0.5;
      pointer-events: none;
      cursor: default;
    }
  `;

  return (
    <DocusealForm
      email={user.email}
      expand={false}
      sendCopyEmail={false}
      withTitle={false}
      withSendCopyButton={false}
      customCss={customCss}
      {...props}
    />
  );
}
