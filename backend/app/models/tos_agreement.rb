# frozen_string_literal: true

class TosAgreement < ApplicationRecord
  belongs_to :user

  validates :user_id, presence: true
  validates :ip_address, presence: true
end
