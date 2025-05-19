# frozen_string_literal: true

class Internal::Demo::CompaniesController < Internal::Demo::BaseController
  def show
    company = Company.find(ENV["DEFAULT_DEMO_COMPANY_ID"]) || e404

    render json: DemoCompanyPresenter.new(company).props
  end
end
