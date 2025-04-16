# frozen_string_literal: true

class EquityGrant < ApplicationRecord
  has_paper_trail

  belongs_to :company_investor
  belongs_to :company_investor_entity, optional: true
  belongs_to :option_pool
  belongs_to :active_exercise, class_name: "EquityGrantExercise", optional: true
  has_one :contract
  has_many :equity_grant_exercise_requests
  has_many :exercises, through: :equity_grant_exercise_requests, source: :equity_grant_exercise

  include ExternalId, Vesting

  enum :issue_date_relationship, {
    employee: "employee",
    consultant: "consultant",
    investor: "investor",
    founder: "founder",
    officer: "officer",
    executive: "executive",
    board_member: "board_member",
  }, prefix: true, validate: true
  enum :option_grant_type, {
    iso: "iso",
    nso: "nso",
  }, prefix: true, validate: true

  validates :name, presence: true,
                   uniqueness: { scope: :company_investor_id }
  validates :issued_at, presence: true
  validates :expires_at, presence: true
  validates :number_of_shares, presence: true,
                               numericality: { only_integer: true, greater_than_or_equal_to: 1 }
  validates :vested_shares, presence: true,
                            numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :exercised_shares, presence: true,
                               numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :forfeited_shares, presence: true,
                               numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :unvested_shares, presence: true,
                              numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :share_price_usd, presence: true,
                              numericality: { greater_than: 0 }
  validates :exercise_price_usd, presence: true,
                                 numericality: {  greater_than: 0 }
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

  validates :option_holder_name, presence: true
  validate :equity_grant_name_must_be_unique_per_company
  validate :number_of_shares_must_equal_sum_of_all_types

  scope :eventually_exercisable, -> { where("vested_shares > 0 OR unvested_shares > 0 OR exercised_shares = 0") }
  scope :accepted, -> { where.not(accepted_at: nil) }

  after_update_commit :update_issued_shares, if: :saved_change_to_number_of_shares?
  after_update_commit :update_total_options, if: -> { saved_change_to_vested_shares? || saved_change_to_unvested_shares? }
  after_destroy_commit :decrement_issued_shares
  after_destroy_commit :decrement_total_options

  private
    def decrement_issued_shares
      option_pool.decrement!(:issued_shares, number_of_shares)
    end

    def decrement_total_options
      company_investor.decrement!(:total_options, number_of_shares)
      company_investor_entity&.decrement!(:total_options, number_of_shares)
    end

    def update_issued_shares
      share_diff = saved_change_to_number_of_shares[1] - saved_change_to_number_of_shares[0]
      option_pool.increment!(:issued_shares, share_diff)
    end

    def update_total_options
      old_value = (saved_change_to_vested_shares? ? saved_change_to_vested_shares[0] : vested_shares) +
                  (saved_change_to_unvested_shares? ? saved_change_to_unvested_shares[0] : unvested_shares)
      new_value = (saved_change_to_vested_shares? ? saved_change_to_vested_shares[1] : vested_shares) +
                  (saved_change_to_unvested_shares? ? saved_change_to_unvested_shares[1] : unvested_shares)
      options_diff = new_value - old_value
      company_investor.increment!(:total_options, options_diff)
      company_investor_entity&.increment!(:total_options, options_diff)
    end

    def equity_grant_name_must_be_unique_per_company
      return unless company_investor
      return unless company_investor.company.equity_grants.where.not(id:).where(name:).exists?

      errors.add(:name, "must be unique across the company")
    end

    def number_of_shares_must_equal_sum_of_all_types
      relevant_attributes = %i[number_of_shares vested_shares exercised_shares forfeited_shares unvested_shares]
      return unless relevant_attributes.any? { |attr| public_send("#{attr}_changed?") }
      return if relevant_attributes.any? { |attr| public_send(attr).nil? }

      total = vested_shares + exercised_shares + forfeited_shares + unvested_shares
      return if number_of_shares == total

      errors.add(:base, "Number of shares must equal the sum of vested, exercised, expired, and unvested shares")
    end
end
