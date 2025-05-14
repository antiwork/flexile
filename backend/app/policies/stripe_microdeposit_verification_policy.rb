# frozen_string_literal: true

class StripeMicrodepositVerificationPolicy < ApplicationPolicy
  def create?
    company_administrator.present?
  end
end
