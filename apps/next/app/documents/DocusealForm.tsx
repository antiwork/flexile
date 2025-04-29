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
    padding: 0.5rem 1rem; /* Increased horizontal padding (px-4 equiv) */
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
    width: auto !important;
    min-width: 250px !important; /* Add minimum width */
    position: absolute !important; /* Ensure absolute positioning is considered */
    bottom: 0 !important; /* Keep original bottom positioning */
    left: 50% !important; /* Position left edge at center */
    transform: translateX(-50%) !important; /* Pull back by half its width */
    margin-left: 0 !important; /* Remove auto margin */
    margin-right: 0 !important; /* Remove auto margin */
    margin-bottom: 0.75rem !important; /* Keep original mb-3 equivalent */
  }

  #expand_form_button:hover,
  #submit_form_button:hover,
  .submitted-form-resubmit-button:hover {
    background-color: #1f2937; /* gray-800 */
    border-color: #1f2937; /* gray-800 */
  }

  #expand_form_button:disabled,
  #submit_form_button:disabled,
  .submitted-form-resubmit-button:disabled {
    opacity: 0.5;
    pointer-events: none;
    cursor: default;
  }

  /* Add styles for the form container */
  #form_container {
    border-radius: 0.5rem !important; /* 8px, rounded-lg */
    /* Add !important to override potential inline styles */
  }

  /* --- Styles for outline buttons (e.g., TYPE, UPLOAD) --- */
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
    background-color: var(--accent) !important; /* Use app's accent color */
    /* Text color might need adjustment on hover depending on accent color */
    /* color: var(--accent-foreground) !important; */
  }
  /* --- End outline button styles --- */

  .submitted-form-company-logo {
    display: none !important;
  }

  .submitted-form-resubmit-button {
    width: 200px !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }

  /* Center the parent container of the resubmit button */
  div:has(> .submitted-form-resubmit-button) {
    text-align: center !important;
  }
`;

// Update props type - Omit only email now
export default function Form(props: Omit<React.ComponentProps<typeof DocusealForm>, "email">) {
  const user = useCurrentUser();

  return (
    <DocusealForm
      // Set default/required props internally
      email={user.email}
      expand={false}
      sendCopyEmail={false}
      withTitle={false}
      withSendCopyButton={false}
      // Remove internal application of customCss
      // Pass through all other props from the parent, including potentially customCss
      {...props}
    />
  );
}
