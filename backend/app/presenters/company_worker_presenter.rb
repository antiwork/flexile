# frozen_string_literal: true

class CompanyWorkerPresenter
  delegate :external_id, :pay_rate_in_subunits, :hours_per_week, :started_at, :ended_at, :role,
           to: :company_worker, allow_nil: true
  delegate :preferred_name, :billing_entity_name, :display_name, :display_email,
           :street_address, :city, :zip_code, :legal_name, to: :user, allow_nil: true

  def initialize(company_worker)
    @company_worker = company_worker
    @user = @company_worker&.user
  end

  def search_result_props
    {
      name: display_name,
      role:,
      url: "/people/#{user.external_id}",
    }
  end

  private
    attr_reader :user, :company_worker
end
