# frozen_string_literal: true

class Internal::Companies::InvestorEntitiesController < Internal::Companies::BaseController
  def show
    authorize CompanyInvestorEntity
    investor_entity = Current.company.company_investor_entities.find_by(external_id: params[:id])

    unless investor_entity
      render json: { error: "Investor entity not found" }, status: :not_found
      return
    end

    render json: InvestorEntityPresenter.new(investor_entity).props
  end
end
