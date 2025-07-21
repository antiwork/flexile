# frozen_string_literal: true

class Internal::Settings::EquityController < Internal::Settings::BaseController
  after_action :verify_authorized

  def update
    authorize [:settings, :equity]
    Current.company_worker.update!(equity_percentage: params[:equity_percentage])
  end
end
