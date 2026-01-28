# frozen_string_literal: true

class CompanyGithubConnection < ApplicationRecord
  belongs_to :company
  belongs_to :connected_by, class_name: "User"

  scope :active, -> { where(revoked_at: nil) }

  validates :github_org_id, presence: true, uniqueness: { scope: :revoked_at, if: :active? }
  validates :github_org_login, presence: true
  validates :installation_id, presence: true, if: :active?, unless: :revoked_at_changed?

  def active?
    revoked_at.nil?
  end
end
