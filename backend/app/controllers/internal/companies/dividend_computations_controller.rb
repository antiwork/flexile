# frozen_string_literal: true

class Internal::Companies::DividendComputationsController < Internal::Companies::BaseController
  before_action :load_computation!, only: [:show]

  def index
    authorize DividendComputation
    computations = Current.company.dividend_computations.order(created_at: :desc)

    render json: {
      dividend_computations: computations.map do |computation|
        shareholder_count = computation.dividend_computation_outputs.where.not(company_investor_id: nil).distinct.count(:company_investor_id) +
                            computation.dividend_computation_outputs.where.not(investor_name: nil).distinct.count(:investor_name)

        {
          id: computation.external_id,
          name: computation.name,
          total_amount_in_usd: computation.total_amount_in_usd,
          dividends_issuance_date: computation.dividends_issuance_date,
          return_of_capital: computation.return_of_capital,
          outputs_count: computation.dividend_computation_outputs.count,
          shareholder_count: shareholder_count,
          created_at: computation.created_at,
          finalized: Current.company.dividend_rounds.joins(:dividends).where(
            issued_at: computation.dividends_issuance_date,
            total_amount_in_cents: (computation.total_amount_in_usd * 100).to_i
          ).exists?,
        }
      end,
    }
  end

  def create
    authorize DividendComputation

    begin
      computation = DividendComputationGeneration.new(
        Current.company,
        amount_in_usd: create_params[:amount_in_usd],
        dividends_issuance_date: create_params[:issued_at],
        return_of_capital: create_params[:return_of_capital],
        release_document: create_params[:release_document]
      ).process

      render json: {
        success: true,
        dividend_computation: {
          id: computation.external_id,
          total_amount_in_usd: computation.total_amount_in_usd,
          dividends_issuance_date: computation.dividends_issuance_date,
          return_of_capital: computation.return_of_capital,
          outputs_count: computation.dividend_computation_outputs.count,
        },
      }
    rescue ActiveRecord::RecordInvalid => e
      render json: {
        success: false,
        error_message: e.message,
      }, status: :unprocessable_entity
    end
  end

  def show
    authorize @computation

    outputs = @computation.dividend_computation_outputs.includes(company_investor: :user).map do |output|
      investor_name = output.investor_name || output.company_investor&.user&.legal_name

      fee_in_usd = Dividend.new(total_amount_in_cents: (output.total_amount_in_usd * 100).to_i).calculate_flexile_fee_cents / 100.0

      {
        investor_name: investor_name,
        share_class: output.share_class,
        number_of_shares: output.number_of_shares,
        hurdle_rate: output.hurdle_rate,
        original_issue_price_in_usd: output.original_issue_price_in_usd,
        dividend_amount_in_usd: output.dividend_amount_in_usd,
        preferred_dividend_amount_in_usd: output.preferred_dividend_amount_in_usd,
        qualified_dividend_amount_usd: output.qualified_dividend_amount_usd,
        total_amount_in_usd: output.total_amount_in_usd,
        fee_in_usd: fee_in_usd,
      }
    end

    render json: {
      dividend_computation: {
        id: @computation.external_id,
        total_amount_in_usd: @computation.total_amount_in_usd,
        dividends_issuance_date: @computation.dividends_issuance_date,
        return_of_capital: @computation.return_of_capital,
        outputs_count: @computation.dividend_computation_outputs.count,
        release_document: @computation.release_document,
        created_at: @computation.created_at,
        outputs: outputs,
      },
    }
  end

  private
    def load_computation!
      @computation = Current.company.dividend_computations.find_by!(external_id: params[:id])
    end

    def create_params
      params.require(:dividend_computation).permit(
        :amount_in_usd,
        :issued_at,
        :return_of_capital,
        :release_document
      )
    end
end
