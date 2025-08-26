# frozen_string_literal: true

class ActorTokenPolicy < ApplicationPolicy
  alias_method :target_user, :record

  def create?
    return false unless company_administrator? &&
                        target_user.present? &&
                        belongs_to_company?

    primary_admin? || !admin?
  end

  private
    def belongs_to_company?
      target_user.all_companies.include?(company)
    end

    def admin?
      target_user.company_administrator_for?(company)
    end

    def primary_admin?
      company.primary_admin&.user_id == user.id
    end
end
