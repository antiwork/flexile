"use client";

import { Plus, MessageSquare, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import React, { useMemo, useState, useEffect } from "react";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import MainLayout from "@/components/layouts/Main";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import Placeholder from "@/components/Placeholder";
import { formatDate } from "@/utils/time";

interface SupportTicket {
  id: string;
  subject: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  emailFrom: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessage: string;
  messageCount: number;
}

const statusNames = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
} as const;

const priorityNames = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
} as const;

const placeholderTickets: SupportTicket[] = [
  {
    id: "1",
    subject: "Unable to approve invoices",
    status: "open",
    priority: "high",
    emailFrom: "john.doe@company.com",
    createdAt: new Date("2024-12-19T10:30:00Z"),
    updatedAt: new Date("2024-12-19T14:15:00Z"),
    lastMessage: "I'm getting an error when trying to approve multiple invoices at once.",
    messageCount: 3,
  },
  {
    id: "2",
    subject: "Question about equity calculations",
    status: "in_progress",
    priority: "medium",
    emailFrom: "sarah.smith@startup.io",
    createdAt: new Date("2024-12-18T09:15:00Z"),
    updatedAt: new Date("2024-12-19T11:30:00Z"),
    lastMessage: "Thanks for the explanation. Could you clarify the vesting schedule?",
    messageCount: 7,
  },
  {
    id: "3",
    subject: "Bank account verification issues",
    status: "resolved",
    priority: "urgent",
    emailFrom: "finance@techcorp.com",
    createdAt: new Date("2024-12-17T16:45:00Z"),
    updatedAt: new Date("2024-12-18T10:20:00Z"),
    lastMessage: "Perfect! The verification went through successfully.",
    messageCount: 5,
  },
  {
    id: "4",
    subject: "How to set up contractor payments?",
    status: "closed",
    priority: "low",
    emailFrom: "hr@newstartup.com",
    createdAt: new Date("2024-12-16T13:20:00Z"),
    updatedAt: new Date("2024-12-17T09:45:00Z"),
    lastMessage: "Thank you for the detailed guide! This was very helpful.",
    messageCount: 4,
  },
  {
    id: "5",
    subject: "Document signing not working",
    status: "open",
    priority: "medium",
    emailFrom: "legal@techfirm.co",
    createdAt: new Date("2024-12-19T08:00:00Z"),
    updatedAt: new Date("2024-12-19T08:00:00Z"),
    lastMessage: "The DocuSeal integration seems to be failing when I try to sign contracts.",
    messageCount: 1,
  },
];

const StatusIcon = ({ status }: { status: SupportTicket["status"] }) => {
  switch (status) {
    case "open":
      return <AlertCircle className="size-4 text-red-500" />;
    case "in_progress":
      return <Clock className="size-4 text-yellow-500" />;
    case "resolved":
    case "closed":
      return <CheckCircle className="size-4 text-green-500" />;
  }
};

const NewTicketModal = ({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim() || !message.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
          priority,
        }),
      });

      if (response.ok) {
        setSubject("");
        setMessage("");
        setPriority("medium");
        onClose();
        onSuccess();
      }
    } catch (_error) {
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New support ticket</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief description of your issue"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="priority">Priority</Label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => {
                const value = e.target.value;
                const validPriorities = ["low", "medium", "high", "urgent"] as const;
                const isValidPriority = (p: string): p is "low" | "medium" | "high" | "urgent" =>
                  validPriorities.some((priority) => priority === p);
                if (isValidPriority(value)) {
                  setPriority(value);
                }
              }}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue in detail"
              rows={4}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !subject.trim() || !message.trim()}>
              {submitting ? "Creating..." : "Create ticket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default function SupportPage() {
  const [data, setData] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);

  const fetchTickets = async () => {
    try {
      const response = await fetch("/api/support");
      const result: unknown = await response.json();

      if (result && typeof result === "object" && !Array.isArray(result)) {
        const resultObj = result;
        const tickets = "tickets" in resultObj ? resultObj.tickets : undefined;

        if (Array.isArray(tickets)) {
          setData(
            tickets.map((ticket: unknown) => {
              if (ticket && typeof ticket === "object" && !Array.isArray(ticket)) {
                const ticketObj = ticket;
                const getId = (obj: object): string => ("id" in obj && typeof obj.id === "string" ? obj.id : "");
                const getSubject = (obj: object): string =>
                  "subject" in obj && typeof obj.subject === "string" ? obj.subject : "";
                const getStatus = (obj: object): "open" | "in_progress" | "resolved" | "closed" => {
                  if ("status" in obj && typeof obj.status === "string") {
                    const validStatuses = ["open", "in_progress", "resolved", "closed"] as const;
                    const isValidStatus = (s: string): s is "open" | "in_progress" | "resolved" | "closed" =>
                      validStatuses.some((status) => status === s);
                    return isValidStatus(obj.status) ? obj.status : "open";
                  }
                  return "open";
                };
                const getPriority = (obj: object): "low" | "medium" | "high" | "urgent" => {
                  if ("priority" in obj && typeof obj.priority === "string") {
                    const validPriorities = ["low", "medium", "high", "urgent"] as const;
                    const isValidPriority = (p: string): p is "low" | "medium" | "high" | "urgent" =>
                      validPriorities.some((priority) => priority === p);
                    return isValidPriority(obj.priority) ? obj.priority : "medium";
                  }
                  return "medium";
                };
                const getEmailFrom = (obj: object): string =>
                  "emailFrom" in obj && typeof obj.emailFrom === "string" ? obj.emailFrom : "";
                const getCreatedAt = (obj: object): Date =>
                  "createdAt" in obj && typeof obj.createdAt === "string" ? new Date(obj.createdAt) : new Date();
                const getUpdatedAt = (obj: object): Date =>
                  "updatedAt" in obj && typeof obj.updatedAt === "string" ? new Date(obj.updatedAt) : new Date();
                const getLastMessage = (obj: object): string =>
                  "lastMessage" in obj && typeof obj.lastMessage === "string" ? obj.lastMessage : "";
                const getMessageCount = (obj: object): number =>
                  "messageCount" in obj && typeof obj.messageCount === "number" ? obj.messageCount : 0;

                return {
                  id: getId(ticketObj),
                  subject: getSubject(ticketObj),
                  status: getStatus(ticketObj),
                  priority: getPriority(ticketObj),
                  emailFrom: getEmailFrom(ticketObj),
                  createdAt: getCreatedAt(ticketObj),
                  updatedAt: getUpdatedAt(ticketObj),
                  lastMessage: getLastMessage(ticketObj),
                  messageCount: getMessageCount(ticketObj),
                };
              }
              return {
                id: "",
                subject: "",
                status: "open" as const,
                priority: "medium" as const,
                emailFrom: "",
                createdAt: new Date(),
                updatedAt: new Date(),
                lastMessage: "",
                messageCount: 0,
              };
            }),
          );
        }
      }
    } catch (_error) {
      setData(placeholderTickets);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTickets();
  }, []);

  const columnHelper = createColumnHelper<SupportTicket>();
  const columns = useMemo(
    () => [
      columnHelper.simple("subject", "Subject", (subject) => <div className="font-medium">{subject}</div>),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => {
          const status = info.getValue();
          return (
            <div className="flex items-center gap-2">
              <StatusIcon status={status} />
              <span>{statusNames[status]}</span>
            </div>
          );
        },
        meta: {
          filterOptions: Object.values(statusNames),
        },
      }),
      columnHelper.accessor("priority", {
        header: "Priority",
        cell: (info) => {
          const priority = info.getValue();
          return (
            <span
              className={`rounded-sm px-2 py-1 text-xs font-medium ${
                priority === "urgent"
                  ? "bg-red-100 text-red-800"
                  : priority === "high"
                    ? "bg-orange-100 text-orange-800"
                    : priority === "medium"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-gray-100 text-gray-800"
              }`}
            >
              {priorityNames[priority]}
            </span>
          );
        },
        meta: {
          filterOptions: Object.values(priorityNames),
        },
      }),
      columnHelper.simple("emailFrom", "From"),
      columnHelper.simple(
        "messageCount",
        "Messages",
        (count) => <span className="tabular-nums">{count}</span>,
        "numeric",
      ),
      columnHelper.simple("updatedAt", "Last updated", formatDate),
      columnHelper.simple("createdAt", "Created", formatDate),
    ],
    [],
  );

  const table = useTable({
    columns,
    data,
    getRowId: (ticket) => ticket.id,
    initialState: {
      sorting: [{ id: "updatedAt", desc: true }],
    },
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableGlobalFilter: true,
  });

  const handleTicketCreated = () => {
    void fetchTickets();
  };

  return (
    <MainLayout
      title="Support"
      headerActions={
        <Button variant="outline" size="small" onClick={() => setShowNewTicketModal(true)}>
          <Plus className="size-4" />
          New ticket
        </Button>
      }
    >
      <div className="grid gap-4">
        {loading ? (
          <div className="py-8 text-center">Loading support tickets...</div>
        ) : data.length > 0 ? (
          <DataTable table={table} searchColumn="subject" />
        ) : (
          <Placeholder icon={MessageSquare}>No support tickets to display.</Placeholder>
        )}
      </div>
      <NewTicketModal
        open={showNewTicketModal}
        onClose={() => setShowNewTicketModal(false)}
        onSuccess={handleTicketCreated}
      />
    </MainLayout>
  );
}
