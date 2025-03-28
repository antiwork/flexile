import { useState } from "react";
import InviteContractorForm from "@/components/InviteContractorForm";
import ContractorListing from "@/components/layouts/ContractorListing";
import Modal from "@/components/Modal";

export default function ContractorsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <ContractorListing>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Contractors</h1>
        <button
          onClick={openModal}
          className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
        >
          Invite Contractor
        </button>
      </div>
      <div className="overflow-hidden rounded-lg bg-white shadow-md">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">Rate</th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Start Date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">{/* Add table rows here */}</tbody>
        </table>
      </div>
      <Modal open={isModalOpen} onClose={closeModal}>
        <InviteContractorForm onClose={closeModal} />
      </Modal>
    </ContractorListing>
  );
}
