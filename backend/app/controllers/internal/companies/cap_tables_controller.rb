# frozen_string_literal: true

class Internal::Companies::CapTablesController < Internal::Companies::BaseController
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

  def export
    authorize :cap_table

    csv_content = InvestorsCsv.new(
      company: Current.company,
      user_role:,
      new_schema: params[:new_schema] == "true"
    ).generate

    filename = "investors-#{Current.company.name.parameterize}-#{Time.current.strftime('%Y-%m-%d_%H%M%S')}.csv"
    response.headers["Content-Disposition"] = "attachment; filename=#{filename}"

    render body: csv_content, content_type: "text/csv"
  end

  private
    def cap_table_params
      params.require(:cap_table).permit(investors: [:userId, :shares])
    end

    def user_role
      if Current.company_administrator?
        "administrator"
      elsif Current.company_lawyer.present?
        "lawyer"
      else
        "investor"
      end
    end
end
