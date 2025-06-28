class ContractorInviteLink < ApplicationRecord
  include Serializable
  include ExternalId

  belongs_to :company
  belongs_to :user

  validates :uuid, presence: true, uniqueness: true
  validates :company_id, uniqueness: { scope: :user_id }

  before_validation :generate_uuid, on: :create

  scope :for_company, ->(company) { where(company: company) }

  def url(base_url = nil)
    "#{base_url}/join/#{uuid}"
  end

  private
    def generate_uuid
      self.uuid ||= SecureRandom.alphanumeric(14)
    end
end
