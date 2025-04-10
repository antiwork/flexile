import React from "react";
import { linkClasses } from "@/components/Link";

const TosAcceptance = () => (
  <div className="text-xs">
    You agree to our{" "}
    <a href="/terms" target="_blank" className={linkClasses}>
      Terms Of Use
    </a>{" "}
    and{" "}
    <a href="/privacy" target="_blank" className={linkClasses}>
      Privacy Policy
    </a>
    .
  </div>
);

export default TosAcceptance;
