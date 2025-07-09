# frozen_string_literal: true

class Internal::Companies::DividendComputationsController < Internal::Companies::BaseController
  before_action :set_dividend_computation, only: [:show, :confirm]

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
    
    service = DividendComputationGeneration.new(
      Current.company,
      **dividend_computation_params
    )
    
    computation = service.process
    
    render json: {
      success: true,
      data: DividendComputationPresenter.new(computation).props
    }, status: :created
  rescue StandardError => e
    render json: {
      success: false,
      error: e.message
    }, status: :unprocessable_entity
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
end