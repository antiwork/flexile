# frozen_string_literal: true

class Internal::Companies::Administrator::Settings::EquityController < Internal::Companies::BaseController
  def show
    company = Current.company
    authorize company

    render json: {
      company: {
        share_price_in_usd: company.share_price_in_usd,
        fmv_per_share_in_usd: company.fmv_per_share_in_usd,
      },
    }
  end

  def update
    company = Current.company
    authorize company

    if company.update(update_params)
      head :ok
    else
      render json: { error: company.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  private
    def update_params
      params.require(:company).permit(
        :share_price_in_usd,
        :fmv_per_share_in_usd,
      )
    end
end
