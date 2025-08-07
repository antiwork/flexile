# frozen_string_literal: true

class CompanyAdministrator < ApplicationRecord
  include ExternalId

  belongs_to :company
  belongs_to :user

  has_many :contracts

  validates :user_id, uniqueness: { scope: :company_id }

  delegate :email, to: :user
end
