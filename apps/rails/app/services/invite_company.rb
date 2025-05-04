# frozen_string_literal: true

class InviteCompany
  def initialize(
    worker:,
    company_administrator_params:,
    company_params:,
    company_worker_params:
  )
    @worker = worker
    @company_administrator_params = company_administrator_params
    @company_params = company_params
    @company_worker_params = company_worker_params
  end

  def perform
    ActiveRecord::Base.transaction do
      administrator = User.find_or_initialize_by(
        email: company_administrator_params[:email],
        country_code: SignUpCompany::US_COUNTRY_CODE
      )

      return {
        success: false,
        errors: {
          "user.email" => "The email is already associated with a Flexile account. Please ask them to invite you as a contractor instead.",
        },
      } if administrator.persisted?

      company = administrator.companies.build(
        email: company_administrator_params[:email],
        country_code: SignUpCompany::US_COUNTRY_CODE,
        default_currency: SignUpCompany::DEFAULT_CURRENCY,
      )
      company.assign_attributes(company_params)

      administrator.invite!(worker) { |u| u.skip_invitation = true }
      company.save!

      company_worker = company.company_workers.create!(company_worker_params.merge(user: worker))
      company_administrator = company.company_administrators.find_by(user: administrator)

      document = CreateConsultingContract.new(company_worker:, company_administrator:, current_user: company_worker.user).perform!
      CompanyWorkerMailer.invite_company(company_worker_id: company_worker.id, url: administrator.create_clerk_invitation).deliver_later

      { success: true, administrator:, company_administrator:, document: }
    end
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.error("InviteCompany error: #{e}")
    { success: false, errors: format_errors(e.record) }
  end

  private
    attr_reader \
      :company_administrator_params,
      :company_params,
      :company_worker_params,
      :docuseal_submission_id,
      :worker

    def format_errors(record)
      errors = {}
      record.errors.to_hash(full_messages: true).each do |field, messages|
        errors["#{record.class.name.underscore}.#{field}"] = messages.first.to_s
      end
      errors
    end
end
