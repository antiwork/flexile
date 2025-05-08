# frozen_string_literal: true

class EquityGrantExercise < ApplicationRecord
  belongs_to :company_investor
  belongs_to :company
  belongs_to :bank_account, class_name: "EquityExerciseBankAccount",
                            foreign_key: :equity_exercise_bank_account_id,
                            optional: true
  has_one_attached :contract
  has_many :equity_grant_exercise_requests
  has_many :equity_grants, through: :equity_grant_exercise_requests

  # Possible `status` values
  PENDING = "pending"
  SIGNED = "signed"
  CANCELLED = "cancelled"
  COMPLETED = "completed"
  ALL_STATUSES = [PENDING, SIGNED, CANCELLED, COMPLETED].freeze

  validates :requested_at, presence: true
  validates :number_of_options, presence: true,
                                numericality: { only_integer: true, greater_than_or_equal_to: 1 }
  validates :total_cost_cents, presence: true,
                               numericality: { only_integer: true, greater_than_or_equal_to: 1 }
  validates :status, presence: true, inclusion: { in: ALL_STATUSES }
  validates :bank_reference, presence: true

  before_validation :set_company, on: :create

  scope :signed, -> { where(status: SIGNED) }

  private
    def set_company
      self.company_id ||= company_investor&.company_id
    end
end
