# frozen_string_literal: true

class CompanyWorkerMailerPreview < ActionMailer::Preview
  def invite_worker
    CompanyWorkerMailer.invite_worker(CompanyWorker.last.id)
  end

  def invoice_rejected_without_reason
    CompanyWorkerMailer.invoice_rejected(invoice_id: Invoice.where(status: Invoice::REJECTED).last.id)
  end

  def invoice_rejected_with_reason
    CompanyWorkerMailer.invoice_rejected(
      invoice_id: Invoice.where(status: Invoice::REJECTED).last.id,
      reason: "Invoice issue date mismatch"
    )
  end


  def payment_sent
    CompanyWorkerMailer.payment_sent(Payment.last.id)
  end

  def payment_failed_reenter_bank_details
    invoice = Payment.last.invoice
    rate = Wise::PayoutApi.new.get_exchange_rate(target_currency: invoice.user.bank_account.currency).first["rate"]
    amount = invoice.cash_amount_in_usd * rate
    currency = invoice.user.bank_account.currency
    CompanyWorkerMailer.payment_failed_reenter_bank_details(Payment.last.id, amount, currency)
  end

  def invoice_approved
    CompanyWorkerMailer.invoice_approved(invoice_id: Invoice.where(equity_percentage: 0).last.id)
  end

  def invoice_with_equity_approved
    CompanyWorkerMailer.invoice_approved(invoice_id: Invoice.where("equity_percentage > 0").last.id)
  end

  def equity_percent_selection
    CompanyWorkerMailer.equity_percent_selection(CompanyWorker.last.id)
  end

  def add_tax_info_reminder
    CompanyWorkerMailer.confirm_tax_info_reminder(
      company_worker_id: CompanyWorker.joins(user: :compliance_info).where(users: { user_compliance_infos: { tax_information_confirmed_at: nil } }).last.id,
      tax_year: 2023,
    )
  end

  def confirm_tax_info_reminder
    CompanyWorkerMailer.confirm_tax_info_reminder(
      company_worker_id: CompanyWorker.joins(user: :compliance_info).where.not(users: { user_compliance_infos: { tax_information_confirmed_at: nil } }).last.id,
      tax_year: 2023,
    )
  end

  def invite_company
    company_worker = CompanyWorker.last
    token = SecureRandom.hex(20)

    CompanyMailer.invite_company(
      company_worker_id: company_worker.id,
      token: token
    )
  end

  def vesting_event_processed
    CompanyWorkerMailer.vesting_event_processed(VestingEvent.last.id)
  end
end
