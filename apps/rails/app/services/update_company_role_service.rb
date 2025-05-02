# frozen_string_literal: true

class UpdateCompanyRoleService
  def initialize(role:, params:, rate_params:)
    @role = role
    @params = params
    @rate_params = rate_params
  end

  def process
    error = nil

    ActiveRecord::Base.transaction do
      update_all_rates = params.delete(:update_all_rates)
      contractors_to_update = role.company_workers
      contractors_to_update = contractors_to_update.where(pay_rate_in_subunits: role.pay_rate_in_subunits) unless update_all_rates

      role.rate.pay_rate_in_subunits = rate_params[:pay_rate_in_subunits]
      role.rate.pay_rate_currency = role.company.default_currency
      role.assign_attributes(params)

      role.save!
      contractors_to_update.update!(pay_rate_in_subunits: role.pay_rate_in_subunits)
    end

    { success: error.nil?, error: }
  rescue ActiveRecord::RecordInvalid => e
    { success: false, error: e.message }
  end

  private
    attr_reader :role, :params, :rate_params
end
