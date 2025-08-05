# frozen_string_literal: true

class UserMailer < ApplicationMailer
  helper :application
  default from: SUPPORT_EMAIL_WITH_NAME

  after_deliver :mark_tax_documents_as_emailed, if: -> { action_name == "tax_form_review_reminder" }

  def otp_code(user_id)
    @user = User.find(user_id)
    @otp_code = @user.otp_code

    mail(to: @user.email, subject: "Your verification code for Flexile")
  end

  def tax_id_validation_failure(user_id)
    @user = User.find(user_id)
    @settings_url = "#{PROTOCOL}://#{DOMAIN}/settings/tax"

    mail(to: @user.email, subject: "Important information about tax reporting")
  end

  def tax_id_validation_success(user_id)
    @user = User.find(user_id)

    mail(to: @user.email, subject: "✅ Thanks for updating your tax information")
  end

  def tax_form_review_reminder(user_compliance_info_id, company_id, tax_year)
    @user_compliance_info = UserComplianceInfo.find(user_compliance_info_id)
    @company = Company.find(company_id)
    @tax_year = tax_year
    @user = @user_compliance_info.user

    @tax_document_names = @user_compliance_info.documents
                                               .alive
                                               .irs_tax_forms
                                               .where(year: @tax_year)
                                               .pluck(:name)
    @title = @tax_document_names.one? ?
                  "Your form #{@tax_document_names.first} from #{@company.name} is ready for review" :
                  "Your tax forms for #{@tax_year} are ready for review"

    mail(to: @user.email, subject: "#{@company.name} tax forms are ready for download")
  end

  private
    def mark_tax_documents_as_emailed
      @user_compliance_info.documents
                           .tax_document
                           .unsigned
                           .where(year: @tax_year)
                           .each do
        _1.touch(:emailed_at)
      end
    end
end
