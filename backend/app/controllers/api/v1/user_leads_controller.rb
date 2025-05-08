# frozen_string_literal: true

class Api::V1::UserLeadsController < Api::V1::BaseController
  skip_before_action :verify_authenticity_token

  def create
    record = UserLead.new(email: params[:email])
    if record.save
      render json: { success: true }, status: :created
    else
      render json: { success: true }, status: :ok
    end
  end
end
