# frozen_string_literal: true

class Internal::Companies::BaseController < Internal::BaseController
  before_action :authenticate_user_json!
  after_action :verify_authorized

  def contractor_status
    authorize Current.user, :show?

    contractor = Current.user.company_workers.find_by(company: Current.company)

    render json: {
      contract_signed_elsewhere: contractor&.contract_signed_elsewhere || false,
      has_active_contract: contractor&.active_contract? || false,
    }
  end
end
