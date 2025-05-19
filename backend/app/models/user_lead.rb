# frozen_string_literal: true

class UserLead < ApplicationRecord
  validates :email, presence: true, uniqueness: true
end
