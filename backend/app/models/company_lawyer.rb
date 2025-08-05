# frozen_string_literal: true

class CompanyLawyer < ApplicationRecord
  include ExternalId

  belongs_to :company
  belongs_to :user

  validates :user_id, uniqueness: { scope: :company_id }

  delegate :email, to: :user
end
