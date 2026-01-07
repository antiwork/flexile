 # frozen_string_literal: true

 class ShareClassPolicy < ApplicationPolicy
   def index?
     return false unless company.equity_enabled?
     company_administrator.present? || company_lawyer.present?
   end
 end
