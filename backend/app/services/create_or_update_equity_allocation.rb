# frozen_string_literal: true

class CreateOrUpdateEquityAllocation
  class Error < StandardError; end

  def initialize(company_worker, equity_percentage:)
    @company_worker = company_worker
    @equity_percentage = equity_percentage
  end

  def perform!
    raise Error, "Feature is not enabled." unless company_worker.company.equity_compensation_enabled?
    raise Error, "Equity allocation is not available." unless company_worker.hourly?

    unvested_equity_grant = company_worker.unique_unvested_equity_grant_for_year(Date.current.year)
    equity_allocation = company_worker.equity_allocations.find_or_initialize_by(year: Date.current.year)
    if unvested_equity_grant.nil? || equity_allocation.locked?
      raise Error, "User #{company_worker.user_id} is not ready to save equity percentage."
    end

    equity_allocation.equity_percentage = equity_percentage
    equity_allocation.save!
  end

  private
    attr_reader :company_worker, :equity_percentage
end
