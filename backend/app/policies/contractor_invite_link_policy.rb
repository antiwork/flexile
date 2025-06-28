class ContractorInviteLinkPolicy < ApplicationPolicy
  def show?
    company_administrator.present?
  end

  def reset?
    company_administrator.present?
  end

  private
    def company_administrator
      Current.company_administrator
    end
end
