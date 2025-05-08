# frozen_string_literal: true

class TimeEntry < ApplicationRecord
  belongs_to :company
  belongs_to :user
end
