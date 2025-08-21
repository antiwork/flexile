# frozen_string_literal: true

class Internal::Companies::Administrator::CapTablesController < Internal::Companies::BaseController
  def create
    authorize :cap_table

    result = CreateCapTable.new(
      company: Current.company,
      investors_data: cap_table_params[:investors]
    ).perform

    if result[:success]
      head :created
    else
      render json: { success: false, errors: result[:errors] }, status: :unprocessable_entity
    end
  end

  private
    def cap_table_params
      params.require(:cap_table).permit(investors: [:userId, :shares])
    end
end
