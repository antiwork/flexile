# frozen_string_literal: true

class Internal::Companies::LiquidationScenariosController < Internal::Companies::BaseController
  before_action :load_liquidation_scenario!, only: [:calculate, :export]

  def calculate
    authorize @liquidation_scenario

    service = LiquidationScenarioCalculation.new(@liquidation_scenario)
    service.process
    
    render json: { success: true, scenario_id: @liquidation_scenario.external_id }
  rescue StandardError => e
    Rails.logger.error "Liquidation calculation failed: #{e.message}"
    Rails.logger.error e.backtrace.join("\n") if Rails.env.development?
    render json: { success: false, error: e.message }, status: :unprocessable_entity
  end

  def export
    authorize @liquidation_scenario
    
    body = LiquidationScenarioCsv.new(@liquidation_scenario).generate
    filename = "liquidation_scenario_#{@liquidation_scenario.external_id}_#{Date.current}.csv"
    response.headers["Content-Disposition"] = "attachment; filename=\"#{filename}\""
    render body:, content_type: "text/csv"
  end

  private

  def load_liquidation_scenario!
    @liquidation_scenario = Current.company.liquidation_scenarios.find_by!(external_id: params[:id])
  end
end