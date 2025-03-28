import React from "react";
import Footer from "@/components/Footer";
import InviteContractorForm from "@/components/InviteContractorForm";

export default function InviteContractorPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <InviteContractorForm />
      <Footer />
    </div>
  );
}
