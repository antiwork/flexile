# frozen_string_literal: true

class CompanyRoleApplication < ApplicationRecord
  include Deletable

  belongs_to :company_role
  has_one :company, through: :company_role

  enum :status, [:pending, :accepted, :denied], validate: true

  normalizes :email, with: -> { _1&.strip&.downcase }
  normalizes :name, with: -> { _1&.strip&.squeeze(" ") }
  normalizes :description, with: -> { _1&.strip }

  delegate :hourly?, to: :company_role, allow_nil: true

  validates_format_of :email, with: URI::MailTo::EMAIL_REGEXP
  validates :name, presence: true
  validates :country_code, presence: true, inclusion: { in: SUPPORTED_COUNTRY_CODES }
  validates :description, presence: true
  validates :hours_per_week, numericality: { greater_than_or_equal_to: 0, only_integer: true }, presence: true, if: :hourly?
  validates :weeks_per_year, numericality: { greater_than_or_equal_to: 0, only_integer: true }, presence: true, if: :hourly?
  validates :equity_percent, numericality: { greater_than_or_equal_to: 0, only_integer: true }, presence: true

  def display_country
    ISO3166::Country[country_code].common_name
  end
end
