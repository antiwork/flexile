# frozen_string_literal: true

require Rails.root.join("lib", "bugsnag_handle_sidekiq_retries_callback")

if Rails.env.staging? || Rails.env.production?
  Bugsnag.configure do |config|
    config.api_key = ENV["BUGSNAG_API_KEY"]
    config.notify_release_stages = %w[production staging]
    custom_ignored_classes = Set.new(%w[ActionController::RoutingError
                                        AbstractController::ActionNotFound
                                        ActionController::UnknownFormat
                                        ActionController::UnknownHttpMethod
                                        Mime::Type::InvalidMimeType])
    config.discard_classes.merge(custom_ignored_classes)
    config.add_on_error BugsnagHandleSidekiqRetriesCallback
  end
end
