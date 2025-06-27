# frozen_string_literal: true

class Internal::InviteLinksController < ApplicationController
  skip_before_action :verify_authenticity_token, only: [:verify]
  before_action :require_token!

  def verify
    puts "Verifying invite with token: #{params[:token]}"
    invite_link = CompanyInviteLink.find_by(token: params[:token])

    if invite_link
      render json: {
        valid: true,
        inviter_name: invite_link.inviter.display_name,
        company_name: invite_link.company.display_name,
        company_id: invite_link.company.external_id,
      }
    else
      render json: { valid: false, error: "Invalid token" }, status: :not_found
    end
  end

  private
    def require_token!
      if params[:token].blank?
        render json: { valid: false, error: "'token' is required" }, status: :bad_request
      end
    end
end
