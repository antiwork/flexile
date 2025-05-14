# frozen_string_literal: true

class WiseCredential < ApplicationRecord
  has_paper_trail

  include Deletable

  validates :profile_id, :api_key, presence: true

  encrypts :profile_id, deterministic: true
  encrypts :api_key

  after_create_commit :delete_outdated_records!, unless: :deleted?

  def self.flexile_credential
    self.alive.where(profile_id: WISE_PROFILE_ID).sole
  end

  private
    def delete_outdated_records!
      self.class.alive.where(profile_id:).where.not(id:).each(&:mark_deleted!)
    end
end
