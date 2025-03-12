import createBoardConsent from "./board_consents/create";
import { sendAdminSigningEmail, sendBoardSigningEmails, sendLawyerApprovalEmails } from "./board_consents/emails";
import lawyerApproval from "./board_consents/lawyerApproval";
import boardApproval from "./board_consents/memberApproval";
import quickbooksFinancialReportSync from "./quickbooksFinancialReportSync";
import quickbooksIntegrationSync from "./quickbooksIntegrationSync";
import quickbooksWorkersSync from "./quickbooksVendorsSync";
import sendCompanyUpdateEmails from "./sendCompanyUpdateEmails";
import sendSlackMessage from "./sendSlackMessage";
import slackWeeklyRecap from "./slackWeeklyRecap";

export default [
  quickbooksWorkersSync,
  quickbooksFinancialReportSync,
  quickbooksIntegrationSync,
  sendCompanyUpdateEmails,
  sendSlackMessage,
  slackWeeklyRecap,
  sendLawyerApprovalEmails,
  sendBoardSigningEmails,
  sendAdminSigningEmail,
  createBoardConsent,
  lawyerApproval,
  boardApproval,
];
