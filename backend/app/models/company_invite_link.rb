# frozen_string_literal: true

# TODO: Move this model on to `Company` model once we have moved away from DocumentTemplates

class CompanyInviteLink < ApplicationRecord
  belongs_to :company
  belongs_to :document_template, optional: true

  before_validation :generate_token, on: :create

  validates :company_id, :token, presence: true
  validates :token, uniqueness: true
  validates :document_template_id, uniqueness: { scope: :company_id, message: "An invite for this company, document template already exists" }

  def reset!
    update!(token: SecureRandom.base58(16))
  end

  private
    def generate_token
      self.token ||= SecureRandom.base58(16)
    end
end
