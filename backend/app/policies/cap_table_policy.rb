# frozen_string_literal: true

class CapTablePolicy < ApplicationPolicy
  def create?
    return false unless company_administrator?

    # Only allow cap table creation for companies with no existing cap table data
    company.cap_table_empty?
  end
end
