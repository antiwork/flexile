# frozen_string_literal: true

class Internal::Companies::Administrator::StripeMicrodepositVerificationsController < Internal::Companies::BaseController
  def create
    authorize :stripe_microdeposit_verification

    verification_params = params[:code].present? ? { descriptor_code: params[:code] } : { amounts: params[:amounts] }
    setup_intent = Stripe::SetupIntent.verify_microdeposits(Current.company.stripe_setup_intent_id, verification_params)

    if setup_intent.status == "succeeded"
      head :ok
    else
      render json: { error: "" }, status: :unprocessable_entity
    end

  rescue Stripe::InvalidRequestError => e
    render json: { error: e.message }, status: :unprocessable_entity
  end
end
