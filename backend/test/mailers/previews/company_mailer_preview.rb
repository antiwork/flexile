# frozen_string_literal: true

class CompanyMailerPreview < ActionMailer::Preview
  def complete_tax_info
    CompanyMailer.complete_tax_info(admin_id: CompanyAdministrator.last.id)
  end


  def consolidated_invoice_receipt
    consolidated_payment = ConsolidatedPayment.last
    company = consolidated_payment.company
    user_id = company.primary_admin.user_id
    consolidated_invoice = consolidated_payment.consolidated_invoice

    if consolidated_invoice.receipt.blank?
      pdf = CreatePdf.new(
        body_html: ApplicationController.render(
          template: "ssr/consolidated_invoice_receipt",
          layout: false,
          locals: { consolidated_invoice: @consolidated_invoice }
        ),
      ).generate

      consolidated_invoice.receipt.attach(
        io: StringIO.new(pdf),
        filename: "invoice.pdf",
        content_type: "application/pdf",
      )
    end

    CompanyMailer.consolidated_invoice_receipt(user_id:, consolidated_payment_id: consolidated_payment.id, processed_date: Time.current.utc.to_fs(:long_date))
  end

  def tax_form_review_reminder
    CompanyMailer.tax_form_review_reminder(company_administrator_id: CompanyAdministrator.last.id, tax_year: 2023)
  end

  def confirm_option_exercise_payment
    equity_exercise = EquityGrantExercise.last
    admin_id = equity_exercise.company.company_administrators.last.id
    CompanyMailer.confirm_option_exercise_payment(admin_id:, exercise_id: equity_exercise.id)
  end

  def verify_stripe_microdeposits
    CompanyMailer.verify_stripe_microdeposits(admin_id: CompanyAdministrator.last.id)
  end

  def stripe_microdeposit_verification_expired
    CompanyMailer.stripe_microdeposit_verification_expired(admin_id: CompanyAdministrator.last.id)
  end

  def email_blast
    CompanyMailer.email_blast(admin_id: CompanyAdministrator.last.id)
  end
end
