# frozen_string_literal: true

class CompanyInviteLink < ApplicationRecord
  belongs_to :company
  belongs_to :inviter, class_name: "User"
  belongs_to :document_template, optional: true

  has_many :invited_users, class_name: "User", foreign_key: "invite_link_id"

  before_validation :generate_token, on: :create

  validates :company_id, :inviter_id, :token, presence: true
  validates :token, uniqueness: true

  validate :unique_per_company_and_template

  def reset!
    update!(token: SecureRandom.base58(16))
  end

  private
    def generate_token
      self.token ||= SecureRandom.base58(16)
    end

    def unique_per_company_and_template
      existing = CompanyInviteLink.where(
        company_id: company_id,
        inviter_id: inviter_id,
        document_template_id: document_template_id
      )

      existing = existing.where.not(id: id) if persisted?

      if existing.exists?
        errors.add(:base, "An invite for this company, inviter, and document template already exists")
      end
    end
end
