# frozen_string_literal: true

class DividendComputationPolicy < ApplicationPolicy
  def index?
    company_administrator? || company_lawyer?
  end

  alias_method :show?, :index?
  alias_method :create?, :index?
  alias_method :update?, :index?
  alias_method :destroy?, :index?
  alias_method :preview?, :index?
  alias_method :finalize?, :index?
  alias_method :export_csv?, :index?
end
