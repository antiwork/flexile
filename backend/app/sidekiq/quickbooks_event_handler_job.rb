# frozen_string_literal: true

class QuickbooksEventHandlerJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(payload)
    return unless payload["eventNotifications"].present?

    Quickbooks::EventHandler.new(payload).process
  end
end
