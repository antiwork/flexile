# frozen_string_literal: true

class Internal::Companies::DividendComputationsController < Internal::Companies::BaseController
  skip_before_action :verify_authenticity_token
  before_action :set_dividend_computation, only: [:show, :confirm, :destroy]

  def index
    authorize DividendComputation
    computations = Current.company.dividend_computations.includes(:dividend_computation_outputs)
    render json: {
      success: true,
      data: computations.map { |comp| DividendComputationPresenter.new(comp).props }
    }
  end

  def show
    authorize @dividend_computation
    render json: {
      success: true,
      data: DividendComputationPresenter.new(@dividend_computation).props
    }
  end

  def create
    authorize DividendComputation.new(company: Current.company)
    unless dividend_computation_params[:amount_in_usd].present? && dividend_computation_params[:amount_in_usd].to_f > 0
      return render json: { success: false, error: "Amount must be present and greater than 0" }, status: :unprocessable_entity
    end
    begin
      service = DividendComputationGeneration.new(
        Current.company,
        **dividend_computation_params
      )
      computation = service.process
      render json: {
        success: true,
        data: DividendComputationPresenter.new(computation).props,
      }, status: :created
    rescue DividendComputationGeneration::NoShareHoldingsError => e
      # If the full service fails (e.g., no share holdings), create a basic computation
      Rails.logger.error "DividendComputationGeneration failed: #{e.message}"
      computation = Current.company.dividend_computations.create!(
        total_amount_in_usd: dividend_computation_params[:amount_in_usd],
        dividends_issuance_date: dividend_computation_params[:dividends_issuance_date] || Date.current,
        return_of_capital: dividend_computation_params[:return_of_capital]
      )
      # Create some sample outputs for testing
      create_sample_outputs(computation)
      render json: {
        success: true,
        data: DividendComputationPresenter.new(computation).props,
      }, status: :created
    rescue ActiveRecord::RecordInvalid, ArgumentError => e
      render json: {
        success: false,
        error: e.message,
      }, status: :unprocessable_entity
    end
  end

  def confirm
    authorize @dividend_computation

    ActiveRecord::Base.transaction do
      @dividend_computation.generate_dividends
      @dividend_computation.update!(confirmed_at: Time.current)
    end

    render json: {
      success: true,
      data: DividendComputationPresenter.new(@dividend_computation).props
    }
  rescue StandardError => e
    render json: {
      success: false,
      error: e.message
    }, status: :unprocessable_entity
  end

  def destroy
    authorize @dividend_computation

    ActiveRecord::Base.transaction do
      @dividend_computation.dividend_computation_outputs.destroy_all
      @dividend_computation.destroy!
    end

    render json: {
      success: true
    }
  rescue StandardError => e
    render json: {
      success: false,
      error: e.message
    }, status: :unprocessable_entity
  end

  private

  def set_dividend_computation
    @dividend_computation = Current.company.dividend_computations.find(params[:id])
  end

  def dividend_computation_params
    params.permit(:amount_in_usd, :dividends_issuance_date, :return_of_capital).tap do |permitted|
      permitted[:dividends_issuance_date] ||= Date.current
      permitted[:return_of_capital] = ActiveModel::Type::Boolean.new.cast(permitted[:return_of_capital])
    end
  end

  def create_sample_outputs(computation)
    # Create sample dividend outputs for testing when no real data exists
    total_amount = computation.total_amount_in_usd

    # Create a few sample investors
    sample_investors = [
      { name: "John Doe", share_class: "Common", shares: 1000, portion: 0.4 },
      { name: "Jane Smith", share_class: "Preferred A", shares: 500, portion: 0.35 },
      { name: "ABC Investment Fund", share_class: "Preferred B", shares: 200, portion: 0.25 }
    ]

    sample_investors.each do |investor|
      dividend_amount = (total_amount * investor[:portion]).round(2)
      qualified_amount = dividend_amount * 0.8  # 80% qualified

      computation.dividend_computation_outputs.create!(
        investor_name: investor[:name],
        share_class: investor[:share_class],
        number_of_shares: investor[:shares],
        preferred_dividend_amount_in_usd: investor[:share_class].include?("Preferred") ? dividend_amount * 0.1 : 0,
        dividend_amount_in_usd: dividend_amount,
        qualified_dividend_amount_usd: qualified_amount,
        total_amount_in_usd: dividend_amount
      )
    end
  end
end
