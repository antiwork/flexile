# frozen_string_literal: true

class DividendPaymentCsv
  HEADERS = ["Client name", "Dividend ID", "Investor name", "Investor email", "Number of shares",
             "Dividend amount", "Date paid", "Date initiated", "Processor", "Transfer ID",
             "Total transaction amount", "Net amount", "Transfer fee", "Tax withholding percentage",
             "Tax withheld"]

  def initialize(dividends)
    @dividends = dividends
  end

  def generate
    data = @dividends.each_with_object([]) do |dividend, row|
      # If there are multiple records found we need to investigate because this should not happen
      payments = dividend.dividend_payments.select { _1.status == Payment::SUCCEEDED }
      next if payments.empty?
      payment = payments.first

      row << [
        dividend.company.name,
        dividend.id,
        dividend.company_investor.user.legal_name,
        dividend.company_investor.user.email,
        dividend.number_of_shares,
        dividend.total_amount_in_cents / 100.0,
        dividend.paid_at,
        payment.created_at,
        payment.processor_name,
        payment.transfer_id,
        payment.total_transaction_cents / 100.0,
        dividend.net_amount_in_cents / 100.0,
        payment.transfer_fee_in_cents ? payment.transfer_fee_in_cents / 100.0 : nil,
        dividend.withholding_percentage,
        dividend.withheld_tax_cents / 100.0,
      ]
    end

    CSV.generate do |csv|
      csv << HEADERS
      data.each do |row|
        csv << row
      end
    end
  end
end

### Usage:
=begin
dividends = Dividend.all
attached = { "DividendPayments.csv" => DividendPaymentCsv.new(dividends).generate }
AdminMailer.custom(to: ["raul@gumroad.com", "solson@earlygrowth.com"],
                   subject: "Dividend payments CSV",
                   body: "Attached", attached:).deliver_now
=end
