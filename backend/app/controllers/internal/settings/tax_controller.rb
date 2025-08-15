# frozen_string_literal: true

class Internal::Settings::TaxController < Internal::Settings::BaseController
  after_action :verify_authorized

  def show
    authorize :tax
    render json: Settings::TaxPresenter.new(user: Current.user).props
  end

  def update
    authorize :tax
    error_message = nil

    user = Current.user
    ApplicationRecord.transaction do
      error_message = UpdateUser.new(user:, update_params:, confirm_tax_info: true).process
    rescue ActiveRecord::ActiveRecordError => e
      Bugsnag.notify(e)
      error_message = e.message
    end

    if error_message.nil?
      head :no_content
    else
      render json: { error_message: }, status: :unprocessable_entity
    end
  end

  private
    def update_params
      params.permit(
        :birth_date,
        :business_entity,
        :business_name,
        :business_type,
        :tax_classification,
        :citizenship_country_code,
        :city,
        :country_code,
        :legal_name,
        :signature,
        :state,
        :street_address,
        :tax_id,
        :zip_code,
      )
    end
end
