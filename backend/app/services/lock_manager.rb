# frozen_string_literal: true

class LockManager
  DEFAULT_LOCK_TIMEOUT = 5000
  DEFAULT_RETRY_COUNT = 5
  DEFAULT_RETRY_JITTER = 200
  DEFAULT_RETRY_DELAY = proc { |attempt_number| 500 * attempt_number**2 }
  DEFAULT_OPTIONS = {
    retry_count: DEFAULT_RETRY_COUNT,
    retry_delay: DEFAULT_RETRY_DELAY,
    retry_jitter: DEFAULT_RETRY_JITTER,
  }.freeze
  private_constant :DEFAULT_RETRY_COUNT, :DEFAULT_RETRY_JITTER, :DEFAULT_RETRY_DELAY

  def initialize(lock_timeout: DEFAULT_LOCK_TIMEOUT, options: {})
    @lock_timeout = lock_timeout
    @client = Redlock::Client.new(
      [RedisClient.new(url: ENV["REDIS_URL"], ssl_params: { verify_mode: OpenSSL::SSL::VERIFY_NONE })],
      DEFAULT_OPTIONS.merge(options),
    )
  end

  def lock!(lock_key, &block)
    client.lock!(lock_key, lock_timeout, &block)
  end

  private
    attr_reader :client, :lock_timeout
end
