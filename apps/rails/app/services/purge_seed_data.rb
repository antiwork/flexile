# frozen_string_literal: true

# Purges data generated via SeedDataGeneratorFromTemplate
#
# Usage:
#   bin/rails runner 'PurgeSeedData.new("owner@flexile.example").perform!'
#
# The email should match the one used to generate the seed data.
#
class PurgeSeedData
  def initialize(email)
    raise "This code should never be run in production." if Rails.env.production?

    @primary_user = User.find_by!(email:)
  end

  def perform!
    PaperTrail.request(enabled: false) do
      user_ids = Set.new([primary_user.id])
      while user_ids.present?
        user_id = user_ids.first
        user = User.find(user_id)
        company = user.company_administrators.first&.company
        user_ids.merge(purge_company!(company)) if company.present?
        purge_user!(user)
        user_ids.delete(user_id)
      end
      purge_other_users!
    end
    print_message("Done.")
  end

  private
    attr_reader :primary_user

    def purge_company!(company)
      purge_invoices!(company)
      purge_documents!(company)
      purge_dividends!(company)
      purge_company_updates!(company)
      purge_balance_transactions!(company)

      user_ids_to_be_purged = purge_company_users!(company)

      purge_equity!(company)
      purge_other_company_data!(company)

      company_name = company.display_name
      company.destroy!
      print_message("Purged company #{company_name}")

      user_ids_to_be_purged
    end

    def purge_invoices!(company)
      Integration.where(company:).find_each do |integration|
        integration.integration_records.each(&:destroy!)
        integration.destroy!
      end

      company.consolidated_invoices.find_each do |consolidated_invoice|
        consolidated_invoice.consolidated_payments.each(&:destroy!)
        consolidated_invoice.destroy!
      end

      company.invoices.find_each do |invoice|
        invoice.payments.each(&:destroy!)
        invoice.invoice_approvals.each(&:destroy!)
        invoice.invoice_line_items.each(&:destroy!)
        invoice.invoice_expenses.each(&:destroy!)
        invoice.destroy!
      end
    end

    def purge_documents!(company)
      company.contracts.each(&:destroy!)
      company.documents.each(&:destroy!)
    end

    def purge_dividends!(company)
      company.dividend_computations.each do |dividend_computation|
        dividend_computation.dividend_computation_outputs.each(&:destroy!)
        dividend_computation.destroy!
      end
      company.dividend_rounds.find_each do |dividend_round|
        dividend_round.dividends.each(&:destroy!)
        dividend_round.destroy!
      end
    end

    def purge_company_updates!(company)
      company.company_updates.each(&:destroy!)
      company.company_monthly_financial_reports.each(&:destroy!)
    end

    def purge_balance_transactions!(company)
      company.balance_transactions.each do |balance_transaction|
        company.with_lock { balance_transaction.destroy! }
      end
    end

    def purge_other_company_data!(company)
      company.expense_categories.each(&:destroy!)
      company.company_stripe_accounts.each(&:destroy!)
      company.balance&.destroy!
    end

    def purge_company_users!(company)
      [
        purge_company_lawyers!(company),
        purge_company_investors!(company),
        purge_company_workers!(company),
        purge_company_administrators!(company)
      ].flatten.compact
    end

    def purge_company_lawyers!(company)
      company.company_lawyers.map do |company_lawyer|
        user_id = company_lawyer.user_id
        company_lawyer.destroy!
        user_id
      end
    end

    def purge_company_administrators!(company)
      company.company_administrators.filter_map do |company_administrator|
        user_id = company_administrator.user_id
        company_administrator.destroy!
        user_id != primary_user.id ? user_id : nil
      end
    end

    def purge_company_investors!(company)
      company.company_investors.map do |company_investor|
        user_id = company_investor.user_id
        purge_company_investor!(company_investor)
        user_id
      end
    end

    def purge_company_investor!(company_investor)
      company_investor.tender_offer_bids.each(&:destroy!)

      company_investor.share_holdings.each do |share_holding|
        company_investor.with_lock { share_holding.destroy! }
      end
      company_investor.investor_dividend_rounds.each(&:destroy!)

      company_investor.convertible_securities.each(&:destroy!)
      company_investor.dividends.each(&:destroy!)
      company_investor.equity_buybacks.each do |equity_buyback|
        equity_buyback.equity_buyback_payments.each(&:destroy!)
        equity_buyback.destroy!
      end
      company_investor.equity_grant_exercises.each(&:destroy!)
      company_investor.equity_grants.each(&:destroy!)
      company_investor.destroy!
    end

    def purge_company_workers!(company)
      company.company_workers.map do |company_worker|
        user_id = company_worker.user_id
        purge_company_worker!(company_worker)
        user_id
      end
    end

    def purge_company_worker!(company_worker)
      company_worker.contracts.each(&:destroy!)
      company_worker.equity_allocations.each(&:destroy!)
      company_worker.destroy!
    end

    def purge_equity!(company)
      company.equity_buyback_rounds.each(&:destroy!)
      company.convertible_investments.each(&:destroy!)
      company.share_classes.each(&:destroy!)
      company.option_pools.each(&:destroy!)
      company.tender_offers.each(&:destroy!)
      EquityExerciseBankAccount.where(company:).each(&:destroy!)
    end

    def purge_user!(user)
      Wallet.where(user:).each(&:destroy!)
      user.user_compliance_infos.each do |user_compliance_info|
        user_compliance_info.tax_documents.each(&:destroy!)
        user_compliance_info.destroy!
      end
      WiseRecipient.where(user:).find_each do |wise_recipient|
        # Cannot delete DividendPayment records that don't have a wise_recipient_id
        DividendPayment.where(wise_recipient_id: wise_recipient.id).find_each(&:destroy!)
        EquityBuybackPayment.where(wise_recipient_id: wise_recipient.id).find_each(&:destroy!)
        wise_recipient.destroy!
      end
      user.time_entries.each(&:destroy!)
      user.tos_agreements.each(&:destroy!)
      email = user.email
      user.destroy!

      print_message("Purged user #{email}")
    end

    def print_message(message, on_new_line: true)
      line_separator = on_new_line ? "\n" : ""

      $stdout.print(line_separator + message)
    end

    def purge_other_users!
      local_part, domain = primary_user.email.split("@")
      User.where("email LIKE ?", "#{local_part}+%@#{domain}").each { purge_user!(_1) }
    end
end
