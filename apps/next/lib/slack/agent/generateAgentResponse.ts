interface AgentResponseParams {
  message: string;
  contractor: any; // Contractor info
  companyId: bigint;
}

interface AgentResponse {
  message: string;
  action?: {
    type: "UPDATE_WEEKLY" | "SUBMIT_INVOICE";
    payload: {
      content?: string;
      amount?: number;
      date?: string;
      description?: string;
    };
  };
}

export const generateAgentResponse = async ({
  message,
  contractor,
  companyId,
}: AgentResponseParams): Promise<AgentResponse> => {
  const lowerCaseMessage = message.toLowerCase();

  if (lowerCaseMessage.includes("update my weekly update")) {
    const contentMatch = message.match(/(?:to contain|to include|with|to say)[:\s]+(.+)/i);
    if (contentMatch && contentMatch[1]) {
      const content = contentMatch[1].trim();
      return {
        message: `I've updated your weekly update with: "${content}"`,
        action: {
          type: "UPDATE_WEEKLY",
          payload: {
            content,
          },
        },
      };
    } else {
      return {
        message: "I couldn't understand what content you wanted to add to your weekly update. Please try again with 'Update my weekly update to contain [your update content]'.",
      };
    }
  }

  if (lowerCaseMessage.includes("submit invoice")) {
    const amountMatch = message.match(/\$\s*([0-9,]+(?:\.[0-9]{2})?)/);
    if (amountMatch && amountMatch[1]) {
      const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
      
      let description;
      const descriptionMatch = message.match(/for\s+(.+?)(?:\s+on\s+|\s*$)/i);
      if (descriptionMatch && descriptionMatch[1] && !descriptionMatch[1].match(/\$[0-9,.]+/)) {
        description = descriptionMatch[1].trim();
      }
      
      let date;
      const dateMatch = message.match(/on\s+(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (dateMatch && dateMatch[1]) {
        const dateParts = dateMatch[1].match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
        if (dateParts) {
          const year = dateParts[3].length === 2 ? `20${dateParts[3]}` : dateParts[3];
          date = `${year}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')}`;
        } else {
          date = dateMatch[1]; // Already in ISO format
        }
      }
      
      return {
        message: `I've submitted an invoice for $${amount}${description ? ` for "${description}"` : ""}${date ? ` dated ${date}` : ""}. You can view it in your invoices dashboard.`,
        action: {
          type: "SUBMIT_INVOICE",
          payload: {
            amount,
            description,
            date,
          },
        },
      };
    } else {
      return {
        message: "I couldn't understand the invoice amount. Please try again with 'Submit invoice for $[amount]'.",
      };
    }
  }

  return {
    message: "I can help you update your weekly update or submit an invoice. Try saying 'Update my weekly update to contain [content]' or 'Submit invoice for $[amount]'.",
  };
};
