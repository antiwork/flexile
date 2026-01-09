# frozen_string_literal: true

class GithubIntegration < Integration
  store_accessor :configuration, :organization

  validates :organization, presence: true, on: :update, unless: -> { status_deleted? }

  def as_json(*)
    super.merge({
      organization:,
    })
  end
end
