# frozen_string_literal: true

class ShareClass < ApplicationRecord
  DEFAULT_NAME = "Common"

  belongs_to :company
  has_many :share_holdings

  validates :name, presence: true, uniqueness: { scope: :company_id }
end
