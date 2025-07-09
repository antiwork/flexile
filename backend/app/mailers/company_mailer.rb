# frozen_string_literal: true

class CompanyMailer < ApplicationMailer
  helper :application
  default from: SUPPORT_EMAIL_WITH_NAME

  def complete_tax_info(admin_id:)
    administrator = CompanyAdministrator.find(admin_id)
    @company = administrator.company

    if @company.tax_id.nil? && @company.phone_number.nil?
      @both_missing = true
    elsif @company.tax_id.nil?
      @both_missing = false
      @missing = { short: "EIN", long: "EIN (Employer Identification Number)" }
    elsif @company.phone_number.nil?
      @both_missing = false
      @missing = { short: "phone number", long: "phone number" }
    else
      return
    end

    mail(to: administrator.email, subject: "🔴 Action needed: complete #{@company.display_name}'s tax info")
  end


  def consolidated_invoice_receipt(user_id:, consolidated_payment_id:, processed_date:)
    user = User.find(user_id)
    consolidated_payment = ConsolidatedPayment.find(consolidated_payment_id)
    @consolidated_invoice = consolidated_payment.consolidated_invoice
    contractors = User.where(id: @consolidated_invoice.invoices.alive.pluck(:user_id))
    @contractor_count = contractors.count
    @country_count = contractors.pluck(:country_code).uniq.count
    @bank_account_last_four = consolidated_payment.bank_account_last_four
    @date = processed_date
    @company = @consolidated_invoice.company

    receipt = @consolidated_invoice.receipt

    if receipt.present?
      attachments[receipt.filename.to_s] = {
        mime_type: "application/pdf",
        content: receipt.download,
      }
    end

    mail(to: user.email, subject: "We processed your payment")
  end

  def tax_form_review_reminder(company_administrator_id:, tax_year:)
    company_administrator = CompanyAdministrator.find(company_administrator_id)
    @company = company_administrator.company
    @tax_year = tax_year

    mail(to: company_administrator.email, subject: "#{@company.name}'s tax forms for #{tax_year} are ready")
  end

  def confirm_option_exercise_payment(admin_id:, exercise_id:)
    administrator = CompanyAdministrator.find(admin_id)
    company = administrator.company
    @exercise = company.equity_grant_exercises.find(exercise_id)
    @company_investor = @exercise.company_investor
    @number_of_options = @exercise.equity_grant_exercise_requests.sum(:number_of_options)
    @bank_account_last_four = company.equity_exercise_bank_account.account_number.last(4)
    @user = @company_investor.user

    mail(to: administrator.email, subject: "🔴 Action needed: #{@user.name}'s stock option exercise")
  end

  def verify_stripe_microdeposits(admin_id:)
    administrator = CompanyAdministrator.find(admin_id)
    @company = administrator.company
    return unless @company.microdeposit_verification_required?

    @arrival_date = Time.at(@company.stripe_setup_intent.next_action.verify_with_microdeposits.arrival_date).utc.to_date.to_fs(:medium)
    @bank_account_last_four = @company.bank_account_last_four
    @via_descriptor_code = @company.microdeposit_verification_details[:microdeposit_type] == "descriptor_code"
    mail(to: administrator.email, subject: "⚠️ Verify your bank account to enable contractor payments")
  end

  def stripe_microdeposit_verification_expired(admin_id:)
    administrator = CompanyAdministrator.find(admin_id)
    @company = administrator.company
    @bank_account_last_four = @company.bank_account_last_four

    mail(to: administrator.email, subject: "⚠️ Action needed: connect your bank account")
  end

  def email_blast(admin_id:)
    administrator = CompanyAdministrator.find(admin_id)

    mail(to: administrator.email, subject: "New Flexile pricing: 1.5% + $0.50, capped at $15/payment")
  end
end
