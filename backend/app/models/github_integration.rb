# frozen_string_literal: true

class GithubIntegration < ApplicationRecord
  has_paper_trail

  include Deletable

  belongs_to :company

  encrypts :access_token, deterministic: false
  encrypts :refresh_token, deterministic: false

  ACTIVE = "active"
  DISCONNECTED = "disconnected"
  STATUSES = [ACTIVE, DISCONNECTED].freeze

  validates :organization_name, presence: true
  validates :organization_id, presence: true
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :company_id, uniqueness: { scope: [], conditions: -> { alive } }

  scope :active, -> { alive.where(status: ACTIVE) }

  def active?
    status == ACTIVE && deleted_at.nil?
  end

  def access_token_valid?
    access_token.present? && (access_token_expires_at.nil? || access_token_expires_at > Time.current)
  end

  def needs_token_refresh?
    access_token_expires_at.present? && access_token_expires_at <= Time.current + 5.minutes
  end

  def update_tokens!(access_token:, expires_at: nil, refresh_token: nil)
    attrs = { access_token: access_token }
    attrs[:access_token_expires_at] = expires_at if expires_at.present?
    attrs[:refresh_token] = refresh_token if refresh_token.present?
    update!(attrs)
  end

  def disconnect!
    update!(status: DISCONNECTED, deleted_at: Time.current)
  end
end
