# frozen_string_literal: true

class Internal::Companies::BaseController < Internal::BaseController
  before_action :authenticate_user_json!
  before_action :ensure_company_is_present!

  after_action :verify_authorized

  private
    def ensure_company_is_present!
      e404 unless Current.company.present?
    end

    def ensure_contractor_can_create_invoices!
      render json: { redirect_path: "/dashboard" },
             status: :forbidden unless Pundit.policy!(pundit_user, Invoice).create?
    end
end
