import { DocusealForm } from "@docuseal/react";
import type React from "react";
import { useCurrentUser } from "@/global";

// Define and export the centralized custom CSS
export const customCss = `
  * {
    font-family: "abc whyte", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
  }

  #expand_form_button,
  #submit_form_button,
  .submitted-form-resubmit-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 1rem;
    border-width: 1px;
    border-radius: 0.5rem;
    gap: 0.375rem;
    white-space: nowrap;
    cursor: pointer;
    background-color: black;
    color: white;
    border-color: black;
    transition: background-color 0.2s ease-in-out, border-color 0.2s ease-in-out;
  }

  /* Unique styles for expand button */
  #expand_form_button {
    width: auto !important;
    min-width: 250px !important;
    position: absolute !important;
    bottom: 0 !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
    margin-bottom: 0.75rem !important;
  }

  #expand_form_button:hover,
  #submit_form_button:hover,
  .submitted-form-resubmit-button:hover {
    background-color: #1f2937;
    border-color: #1f2937;
  }

  #expand_form_button:disabled,
  #submit_form_button:disabled,
  .submitted-form-resubmit-button:disabled {
    opacity: 0.5;
    pointer-events: none;
    cursor: default;
  }

  #form_container {
    border-radius: 0.5rem !important;
  }

  #type_text_button,
  .upload-image-button {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 0.25rem 0.75rem !important; /* py-1 px-3 for btn-sm */
    border-width: 1px !important;
    border-radius: 0.5rem !important; /* rounded-lg */
    gap: 0.375rem !important; /* gap-1.5 */
    white-space: nowrap !important;
    cursor: pointer !important;
    background-color: var(--background) !important; /* Changed from transparent */
    color: var(--foreground) !important; /* Use app's foreground color */
    border-color: var(--border) !important; /* Use app's border color */
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05) !important; /* shadow-xs */
    transition: background-color 0.2s ease-in-out, border-color 0.2s ease-in-out !important;
  }

  #type_text_button:hover,
  .upload-image-button:hover {
    background-color: var(--accent) !important;
  }

  .submitted-form-company-logo {
    display: none !important;
  }

  .submitted-form-resubmit-button {
    width: 200px !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }

  .scrollbox {
    min-height: 500px;
  }

  div:has(> .submitted-form-resubmit-button) {
    text-align: center !important;
  }
`;

// Update props type - Omit only email now
export default function Form(props: Omit<React.ComponentProps<typeof DocusealForm>, "email">) {
  const user = useCurrentUser();

  return (
    <DocusealForm
      email={user.email}
      expand={false}
      sendCopyEmail={false}
      withTitle={false}
      withSendCopyButton={false}
      rememberSignature
      {...props}
    />
  );
}
