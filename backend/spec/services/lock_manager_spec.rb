# frozen_string_literal: true

RSpec.describe LockManager do
  describe "#lock!" do
    let(:lock_key) { "lock_key" }

    context "when the lock is acquired" do
      it "yields to the block" do
        expect(RedisClient).to receive(:new)
                                 .with(url: ENV["REDIS_URL"], ssl_params: { verify_mode: OpenSSL::SSL::VERIFY_NONE })
                                 .and_call_original
        expect(Redlock::Client).to receive(:new)
                                     .with([an_instance_of(RedisClient)], described_class::DEFAULT_OPTIONS)
                                     .and_call_original
        expect_any_instance_of(Redlock::Client).to receive(:lock!)
                                                     .with(lock_key, described_class::DEFAULT_LOCK_TIMEOUT)
                                                     .and_yield

        expect { |b| described_class.new.lock!(lock_key, &b) }.to yield_with_no_args
      end

      context "when custom options are passed" do
        let(:options) { { retry_count: 3, retry_delay: 1000, retry_jitter: 100 } }

        it "passes the options to Redlock::Client" do
          expect(RedisClient).to receive(:new)
                                   .with(url: ENV["REDIS_URL"], ssl_params: { verify_mode: OpenSSL::SSL::VERIFY_NONE })
                                   .and_call_original
          expect(Redlock::Client).to receive(:new).with([an_instance_of(RedisClient)], options).and_call_original
          expect_any_instance_of(Redlock::Client).to receive(:lock!)
                                                       .with(lock_key, described_class::DEFAULT_LOCK_TIMEOUT)
                                                       .and_yield

          expect { |b| described_class.new(options:).lock!(lock_key, &b) }.to yield_with_no_args
        end
      end

      context "when custom lock_timeout is passed" do
        let(:lock_timeout) { 200 }

        it "passes the lock_timeout to Redlock::Client" do
          expect(RedisClient).to receive(:new)
                                   .with(url: ENV["REDIS_URL"], ssl_params: { verify_mode: OpenSSL::SSL::VERIFY_NONE })
                                   .and_call_original
          expect(Redlock::Client).to receive(:new)
                                       .with([an_instance_of(RedisClient)], described_class::DEFAULT_OPTIONS)
                                       .and_call_original
          expect_any_instance_of(Redlock::Client).to receive(:lock!).with(lock_key, lock_timeout).and_yield

          expect { |b| described_class.new(lock_timeout:).lock!(lock_key, &b) }.to yield_with_no_args
        end
      end
    end

    context "when the lock is not available" do
      let(:lock_timeout) { 200 }
      let(:lock_manager) do
        Redlock::Client.new(
          [RedisClient.new(url: ENV["REDIS_URL"], ssl_params: { verify_mode: OpenSSL::SSL::VERIFY_NONE })],
          options,
        )
      end

      context "when using default options" do
        let(:options) { described_class::DEFAULT_OPTIONS }

        before { @another_lock_info = lock_manager.lock(lock_key, lock_timeout) }
        after { lock_manager.unlock(@another_lock_info) }

        it "waits on the lock to be released and successfully acquires another lock" do
          expect(RedisClient).to receive(:new)
                                   .with(url: ENV["REDIS_URL"], ssl_params: { verify_mode: OpenSSL::SSL::VERIFY_NONE })
                                   .and_call_original
          expect(Redlock::Client).to receive(:new)
                                       .with([an_instance_of(RedisClient)], described_class::DEFAULT_OPTIONS)
                                       .and_call_original
          expect_any_instance_of(Redlock::Client).to receive(:lock!)
                                                       .with(lock_key, lock_timeout)
                                                       .and_call_original
          expect_any_instance_of(Redlock::Client).to receive(:sleep).at_least(:once).and_call_original
          expect { |b| described_class.new(lock_timeout:).lock!(lock_key, &b) }.to yield_with_no_args
        end
      end

      context "when using custom options" do
        let(:options) { { retry_count: 3, retry_delay: 1000, retry_jitter: 50 } }

        before { @another_lock_info = lock_manager.lock(lock_key, lock_timeout) }
        after { lock_manager.unlock(@another_lock_info) }

        it "sleeps a maximum of retry_delay + retry_jitter in milliseconds" do
          expect(RedisClient).to receive(:new)
                                   .with(url: ENV["REDIS_URL"], ssl_params: { verify_mode: OpenSSL::SSL::VERIFY_NONE })
                                   .and_call_original
          expect(Redlock::Client).to receive(:new).with([an_instance_of(RedisClient)], options).and_call_original
          expect_any_instance_of(Redlock::Client).to receive(:lock!)
                                                       .with(lock_key, lock_timeout)
                                                       .and_call_original

          expected_maximum = options[:retry_delay] + options[:retry_jitter]
          expect_any_instance_of(Redlock::Client).to receive(:sleep) do |duration|
            expect(duration).to satisfy { |value| value < expected_maximum / 1000.to_f }
          end.at_least(:once).and_call_original
          expect { |b| described_class.new(lock_timeout:, options:).lock!(lock_key, &b) }.to yield_with_no_args
        end
      end

      context "when the lock is not acquired after the maximum number of retries" do
        let(:lock_timeout) { 200 }
        let(:options) { { retry_count: 1, retry_delay: 500, retry_jitter: 50 } }

        before { @another_lock_info = lock_manager.lock(lock_key, described_class::DEFAULT_LOCK_TIMEOUT) }
        after { lock_manager.unlock(@another_lock_info) }

        it "raises an error" do
          expect(RedisClient).to receive(:new)
                                   .with(url: ENV["REDIS_URL"], ssl_params: { verify_mode: OpenSSL::SSL::VERIFY_NONE })
                                   .and_call_original
          expect(Redlock::Client).to receive(:new).with([an_instance_of(RedisClient)], options).and_call_original
          expect_any_instance_of(Redlock::Client).to receive(:lock!)
                                                       .with(lock_key, lock_timeout)
                                                       .and_call_original
          expect_any_instance_of(Redlock::Client).to receive(:sleep).at_least(:once).and_call_original
          expect do
            described_class.new(lock_timeout:, options:).lock!(lock_key) { }
          end.to raise_error(Redlock::LockError, "failed to acquire lock on '#{lock_key}'")
        end
      end
    end

    context "when a different lock is acquired" do
      let(:another_lock_key) { "another_lock_key" }
      let(:lock_manager) do
        Redlock::Client.new(
          [RedisClient.new(url: ENV["REDIS_URL"], ssl_params: { verify_mode: OpenSSL::SSL::VERIFY_NONE })],
          described_class::DEFAULT_OPTIONS,
        )
      end

      before { @another_lock_info = lock_manager.lock(another_lock_key, described_class::DEFAULT_LOCK_TIMEOUT) }
      after { lock_manager.unlock(@another_lock_info) }

      it "acquires the lock immediately and yields to the block" do
        expect(RedisClient).to receive(:new)
                                 .with(url: ENV["REDIS_URL"], ssl_params: { verify_mode: OpenSSL::SSL::VERIFY_NONE })
                                 .and_call_original
        expect(Redlock::Client).to receive(:new)
                                     .with([an_instance_of(RedisClient)], described_class::DEFAULT_OPTIONS)
                                     .and_call_original
        expect_any_instance_of(Redlock::Client).to receive(:lock!)
                                                     .with(lock_key, described_class::DEFAULT_LOCK_TIMEOUT)
                                                     .and_yield
        expect_any_instance_of(Redlock::Client).to_not receive(:sleep)

        expect { |b| described_class.new.lock!(lock_key, &b) }.to yield_with_no_args
      end
    end
  end
end
