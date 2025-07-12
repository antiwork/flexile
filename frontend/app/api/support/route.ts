import { NextResponse } from "next/server";

interface SupportTicket {
  id: string;
  subject: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  emailFrom: string;
  createdAt: string;
  updatedAt: string;
  lastMessage: string;
  messageCount: number;
}

const placeholderTickets: SupportTicket[] = [
  {
    id: "1",
    subject: "Unable to approve invoices",
    status: "open",
    priority: "high",
    emailFrom: "john.doe@company.com",
    createdAt: "2024-12-19T10:30:00Z",
    updatedAt: "2024-12-19T14:15:00Z",
    lastMessage: "I'm getting an error when trying to approve multiple invoices at once.",
    messageCount: 3,
  },
  {
    id: "2",
    subject: "Question about equity calculations",
    status: "in_progress",
    priority: "medium",
    emailFrom: "sarah.smith@startup.io",
    createdAt: "2024-12-18T09:15:00Z",
    updatedAt: "2024-12-19T11:30:00Z",
    lastMessage: "Thanks for the explanation. Could you clarify the vesting schedule?",
    messageCount: 7,
  },
  {
    id: "3",
    subject: "Bank account verification issues",
    status: "resolved",
    priority: "urgent",
    emailFrom: "finance@techcorp.com",
    createdAt: "2024-12-17T16:45:00Z",
    updatedAt: "2024-12-18T10:20:00Z",
    lastMessage: "Perfect! The verification went through successfully.",
    messageCount: 5,
  },
  {
    id: "4",
    subject: "How to set up contractor payments?",
    status: "closed",
    priority: "low",
    emailFrom: "hr@newstartup.com",
    createdAt: "2024-12-16T13:20:00Z",
    updatedAt: "2024-12-17T09:45:00Z",
    lastMessage: "Thank you for the detailed guide! This was very helpful.",
    messageCount: 4,
  },
  {
    id: "5",
    subject: "Document signing not working",
    status: "open",
    priority: "medium",
    emailFrom: "legal@techfirm.co",
    createdAt: "2024-12-19T08:00:00Z",
    updatedAt: "2024-12-19T08:00:00Z",
    lastMessage: "The DocuSeal integration seems to be failing when I try to sign contracts.",
    messageCount: 1,
  },
];

export function GET() {
  try {
    return NextResponse.json({ tickets: placeholderTickets });
  } catch (_error) {
    return NextResponse.json({ error: "Failed to fetch support tickets" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const requestBody = body;
    const subject = "subject" in requestBody ? requestBody.subject : undefined;
    const message = "message" in requestBody ? requestBody.message : undefined;
    const priority = "priority" in requestBody ? requestBody.priority : "medium";

    if (!subject || typeof subject !== "string" || subject.trim().length === 0) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    }

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    if (priority !== "medium" && priority && typeof priority !== "string") {
      return NextResponse.json({ error: "Priority must be a string" }, { status: 400 });
    }

    const validPriorities = ["low", "medium", "high", "urgent"] as const;
    const priorityStr = typeof priority === "string" ? priority : "medium";
    const isValidPriority = (p: string): p is "low" | "medium" | "high" | "urgent" =>
      validPriorities.some((priority) => priority === p);
    const ticketPriority: "low" | "medium" | "high" | "urgent" = isValidPriority(priorityStr) ? priorityStr : "medium";

    const newTicket: SupportTicket = {
      id: (placeholderTickets.length + 1).toString(),
      subject: subject.trim(),
      status: "open",
      priority: ticketPriority,
      emailFrom: "user@example.com",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastMessage: message.trim(),
      messageCount: 1,
    };

    return NextResponse.json({
      success: true,
      ticket: newTicket,
    });
  } catch (_error) {
    return NextResponse.json({ error: "Failed to create support ticket" }, { status: 500 });
  }
}
