# frozen_string_literal: true

class FinancingRound < ApplicationRecord
  include ExternalId

  belongs_to :company

  validates :issued_at, presence: true
  validates :shares_issued, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :price_per_share_cents, presence: true, numericality: { greater_than: 0 }
  validates :amount_raised_cents, presence: true, numericality: { greater_than: 0 }
  validates :post_money_valuation_cents, presence: true, numericality: { greater_than: 0 }
  validates :status, presence: true, inclusion: { in: %w(Issued) }
  validate :investors_json_must_validate_schema
  attribute :investors, :json, default: []

  private
    INVESTORS_SCHEMA = {
      "$schema": "http://json-schema.org/draft-06/schema#",
      type: "array",
      items: { "$ref": "#/$defs/investor" },
      "$defs": {
        investor: {
          type: "object",
          properties: {
            name: { type: "string" },
            amount_invested_cents: { type: "number" },
          },
          required: [:name, :amount_invested_cents],
        },
      },
    }.freeze
    private_constant :INVESTORS_SCHEMA

    def investors_json_must_validate_schema
      return errors.add(:investors, "cannot be nil") if investors.nil?

      JSON::Validator.fully_validate(INVESTORS_SCHEMA, investors).each { errors.add(:investors, _1) }
    end
end
