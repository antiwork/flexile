# frozen_string_literal: true

class CompanyUpdate < ApplicationRecord
  has_paper_trail

  include ExternalId

  DRAFT = "Draft"
  SENT = "Sent"

  belongs_to :company


  validates :title, presence: true
  validates :body, presence: true

  scope :sent, -> { where.not(sent_at: nil) }


  def status
    sent_at.present? ? SENT : DRAFT
  end
end
