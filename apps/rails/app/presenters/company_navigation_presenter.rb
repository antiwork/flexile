# frozen_string_literal: true

class CompanyNavigationPresenter
  def initialize(user:, company:)
    @company = company
    @user = user
  end

  def props
    current_context = CurrentContext.new(user:, company:)
    {
      id: company.external_id,
      name: company.display_name,
      logo_url: company.logo_url,
      routes: CompanyNavigationPresenter::RoutesInfo.new(current_context:).props,
    }
  end

  private
    attr_reader :company, :user, :access_roles
end
