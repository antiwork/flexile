# frozen_string_literal: true

class CompanyInvestorPresenter
  delegate :external_id, :company, to: :company_investor

  def initialize(company_investor)
    @company_investor = company_investor
    @user = @company_investor&.user
  end

  def search_result_props
    {
      name: user.display_name,
      role: "Investor",
      url: "/people/#{user.external_id}",
    }
  end

  private
    attr_reader :company_investor, :user
end
