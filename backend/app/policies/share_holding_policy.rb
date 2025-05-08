# frozen_string_literal: true

# TODO (techdebt): remove as no longer used
class ShareHoldingPolicy < ApplicationPolicy
  def index?
    company_investor.present?
  end
end
