# frozen_string_literal: true

class Internal::Companies::CapTablesController < Internal::Companies::BaseController
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
