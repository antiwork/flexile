# frozen_string_literal: true

class UserGithubConnection < ApplicationRecord
  belongs_to :user

  validates :github_username, presence: true
  validates :github_id, presence: true, uniqueness: true
  validates :access_token, presence: true
  validates :user_id, uniqueness: true
end