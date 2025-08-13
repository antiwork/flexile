# frozen_string_literal: true

class CreateOrUpdateCompanyUpdate
  def initialize(company:, company_update_params:, company_update: nil)
    @company = company
    @company_update = company_update.presence || company.company_updates.new
    @company_update_params = company_update_params
  end

  def perform!
    company_update.assign_attributes(company_update_params)

    company_update.save!

    { success: true, company_update: }
  end

  private
    attr_reader :company, :company_update_params, :company_update
end
