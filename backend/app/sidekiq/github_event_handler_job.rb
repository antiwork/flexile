# frozen_string_literal: true

class GithubEventHandlerJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(webhook_id, payload)
    return unless payload.present?

    Github::EventHandler.new(webhook_id, payload).process
  end
end
