# frozen_string_literal: true

class UpdateUser
  def initialize(user:, update_params:, confirm_tax_info: false)
    @user = user
    @update_params = update_params.except(*User::USER_PROVIDED_TAX_ATTRIBUTES)
    @compliance_attributes = update_params.to_hash.symbolize_keys.slice(*User::COMPLIANCE_ATTRIBUTES)
    @compliance_attributes[:tax_information_confirmed_at] = Time.current if confirm_tax_info.present?
  end

  def process
    error = nil
    begin
      ApplicationRecord.transaction do
        user.assign_attributes(update_params)
        user.build_compliance_info(compliance_attributes)
        user.save!
      end
    rescue ActiveRecord::RecordInvalid
      error = user.errors.full_messages.any? ? user.errors.full_messages.join(". ") : "Error saving information"
    end

    error if error.present?
  end

  private
    attr_reader :user, :update_params, :compliance_attributes
end
