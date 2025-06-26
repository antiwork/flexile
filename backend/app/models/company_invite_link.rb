# frozen_string_literal: true

class CompanyInviteLink < ApplicationRecord
  belongs_to :company
  belongs_to :inviter, class_name: "User"

  before_validation :generate_token, on: :create

  validates :company_id, presence: true
  validates :inviter_id, presence: true
  validates :token, presence: true, uniqueness: true
  validates :inviter_id, uniqueness: { scope: :company_id, message: "can only have one invite link per company" }

  def self.reset_for(invite_link)
    invite_link.send(:generate_token)
    invite_link.save!
    invite_link
  end

  private
    def generate_token
      self.token = SecureRandom.urlsafe_base64(16)
    end
end
