# frozen_string_literal: true

class OptionPool < ApplicationRecord
  include ExternalId

  belongs_to :company
  belongs_to :share_class
  has_many :equity_grants

  validates :name, presence: true
  validates :default_option_expiry_months, presence: true,
                                           numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :authorized_shares, presence: true,
                                numericality: { only_integer: true, greater_than_or_equal_to: 1 }
  validates :issued_shares, presence: true,
                            numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :voluntary_termination_exercise_months, presence: true,
                                                    numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :involuntary_termination_exercise_months, presence: true,
                                                      numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :termination_with_cause_exercise_months, presence: true,
                                                     numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :death_exercise_months, presence: true,
                                    numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :disability_exercise_months, presence: true,
                                         numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :retirement_exercise_months, presence: true,
                                         numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  validate :issued_shares_cannot_exceed_authorized_shares

  private
    def issued_shares_cannot_exceed_authorized_shares
      return if authorized_shares.nil? || issued_shares.nil?
      return if issued_shares <= authorized_shares

      errors.add(:issued_shares, "cannot be greater than authorized shares")
    end
end
