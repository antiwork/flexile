# frozen_string_literal: true

class CompanyInvitationPolicy < ApplicationPolicy
  def index?
    user.inviting_company?
  end

  def new?
    index?
  end

  def create?
    index?
  end
end
