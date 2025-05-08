# frozen_string_literal: true

class WhodunnitMiddleware
  def call(job_instance, _job_payload, _queue)
    Current.whodunnit = job_instance.class.name
    yield
  ensure
    Current.whodunnit = nil
  end
end

Sidekiq.configure_server do |config|
  config.redis = { url: ENV["SIDEKIQ_REDIS_URL"], ssl_params: { verify_mode: OpenSSL::SSL::VERIFY_NONE } }

  if defined?(Sidekiq::Pro)
    # https://github.com/mperham/sidekiq/wiki/Reliability#using-super_fetch
    config.super_fetch!

    # https://github.com/mperham/sidekiq/wiki/Reliability#scheduler
    config.reliable_scheduler!
  end

  # The number of jobs that are stored after retries are exhausted.
  config[:dead_max_jobs] = 50_000

  config.server_middleware do |chain|
    chain.add WhodunnitMiddleware
  end
end

Sidekiq.configure_client do |config|
  config.redis = { size: 3, url: ENV["SIDEKIQ_REDIS_URL"], ssl_params: { verify_mode: OpenSSL::SSL::VERIFY_NONE } }
end

# https://github.com/mperham/sidekiq/wiki/Pro-Reliability-Client
Sidekiq::Client.reliable_push! if defined?(Sidekiq::Pro) && !Rails.env.test?

# Store exception backtrace
# https://github.com/mperham/sidekiq/wiki/Error-Handling#backtrace-logging
Sidekiq.default_job_options = { "backtrace" => true, "retry" => 25 }
