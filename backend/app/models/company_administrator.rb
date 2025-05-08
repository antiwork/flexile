# frozen_string_literal: true

class CompanyAdministrator < ApplicationRecord
  include Searchable, ExternalId

  belongs_to :company
  belongs_to :user

  has_many :contracts

  validates :user_id, uniqueness: { scope: :company_id }
  validates :board_member, inclusion: { in: [true, false] }

  delegate :email, to: :user
end
