"use client";
import EditPage from "@/app/(dashboard)/updates/company/Edit";
import { Modal } from "@/components/Modal";

export default function NewModal() {
  return (
    <Modal title="New company update">
      <EditPage isModal />
    </Modal>
  );
}
