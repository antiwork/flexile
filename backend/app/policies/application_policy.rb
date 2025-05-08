# frozen_string_literal: true

class ApplicationPolicy
  def initialize(current_context, record)
    @current_context = current_context
    @record = record
  end

  private
    attr_reader :current_context, :record

    delegate :user,
             :company,
             :company_administrator,
             :company_administrator?,
             :company_worker,
             :company_worker?,
             :company_investor,
             :company_investor?,
             :company_lawyer,
             :company_lawyer?,
             to: :current_context,
             private: true

    def authorized_to(action, record)
      Pundit.policy!(current_context, record).public_send(action)
    end
end
