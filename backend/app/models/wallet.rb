# frozen_string_literal: true

class Wallet < ApplicationRecord
  include Deletable

  belongs_to :user

  validates_presence_of :wallet_address
  validates_format_of :wallet_address, with: /\A0x[a-fA-F0-9]{40}\z/
end
