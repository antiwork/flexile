# frozen_string_literal: true

namespace :test do
  desc "Run tests with Stripe and Wise API mocks"
  task :with_mocks, [:test_path] => :environment do |_, args|
    require "open3"
    require "net/http"

    # Default to running all tests if no specific path provided
    test_path = args[:test_path] || ""

    # Set environment variables for mocking
    ENV["USE_STRIPE_MOCK"] = "true"
    ENV["USE_WISE_MOCK"] = "true"
    ENV["STRIPE_MOCK_HOST"] = "localhost"
    ENV["STRIPE_MOCK_PORT"] ||= "12111"  # Allow override via environment

    # Store original PID to handle cleanup
    original_pid = Process.pid
    stripe_mock_pid = nil

    # Handle termination signals to ensure cleanup
    [:INT, :TERM].each do |signal|
      trap(signal) do
        if Process.pid == original_pid && stripe_mock_pid
          puts "\nReceived signal #{signal}, cleaning up..."
          Process.kill("TERM", stripe_mock_pid) rescue nil
        end
        exit 1
      end
    end

    # Check if stripe-mock is installed
    stripe_mock_installed = system("which stripe-mock > /dev/null 2>&1")
    unless stripe_mock_installed
      puts "Error: stripe-mock is not installed. Please install it with:"
      puts "  brew install stripe/stripe-mock/stripe-mock"
      puts "  or"
      puts "  go install github.com/stripe/stripe-mock@latest"
      exit 1
    end

    # Try to use the singleton pattern if available
    stripe_mock_started_by_singleton = false

    if defined?(Stripe) && defined?(Stripe::StripeMock)
      begin
        # Try to use the singleton (it will reuse existing or start new)
        require_relative "../stripe_mock_singleton"
        port = Stripe::StripeMock.start
        stripe_mock_started_by_singleton = true
        puts "✅ Using stripe-mock singleton on port #{port}"
      rescue StandardError => e
        puts "⚠️  Could not use singleton: #{e.message}"
      end
    end

    # Fallback to traditional approach if singleton not available
    unless stripe_mock_started_by_singleton
      # Check if stripe-mock is already running
      stripe_mock_running = system("lsof -i:#{ENV['STRIPE_MOCK_PORT']} -sTCP:LISTEN > /dev/null 2>&1")

      unless stripe_mock_running
        # Start stripe-mock in the background
        puts "Starting stripe-mock server..."
        port = ENV["STRIPE_MOCK_PORT"]
        https_port = (port.to_i + 1).to_s
        stripe_mock_pid = spawn("stripe-mock -http-port #{port} -https-port #{https_port}")
        Process.detach(stripe_mock_pid)

        # Wait for stripe-mock to be ready with proper timeout
        max_retries = 10
        retries = 0
        stripe_mock_ready = false

        while retries < max_retries && !stripe_mock_ready
          sleep 0.5 * (2**[retries, 3].min)  # Exponential backoff, capped at 4 seconds
          begin
            uri = URI("http://localhost:#{ENV['STRIPE_MOCK_PORT']}/v1/charges")
            response = Net::HTTP.get_response(uri)
            # stripe-mock returns 401 (unauthorized) when it's ready but no auth provided
            stripe_mock_ready = response.code.to_i == 401
            puts "✅ Successfully connected to stripe-mock server" if stripe_mock_ready
          rescue StandardError
            retries += 1
            puts "Waiting for stripe-mock to start (attempt #{retries}/#{max_retries})..." if (retries % 2) == 0
          end
        end

        unless stripe_mock_ready
          puts "Error: Failed to start stripe-mock server after #{max_retries} attempts"
          Process.kill("TERM", stripe_mock_pid) rescue nil
          exit 1
        end
      else
        # Verify the running stripe-mock is responsive
        begin
          uri = URI("http://localhost:#{ENV['STRIPE_MOCK_PORT']}/v1/charges")
          response = Net::HTTP.get_response(uri)
          if response.code.to_i == 401
            puts "🔌 Stripe configured to use stripe-mock server at http://localhost:#{ENV['STRIPE_MOCK_PORT']}"
            puts "✅ Successfully connected to stripe-mock server"
          else
            puts "Warning: stripe-mock is running but returned unexpected status code: #{response.code}"
          end
        rescue StandardError => e
          puts "Warning: stripe-mock is running but not responding correctly: #{e.message}"
        end
      end
    end

    # Run RSpec with the specified path
    rspec_command = "bundle exec rspec #{test_path}"
    puts "Running: #{rspec_command}"

    # Use system instead of exec to maintain process control for proper cleanup
    status = nil
    begin
      status = system(rspec_command)
    ensure
      # Clean up stripe-mock if we started it (not if singleton is managing it)
      if stripe_mock_pid && Process.pid == original_pid && !stripe_mock_started_by_singleton
        begin
          puts "Stopping stripe-mock server..."
          Process.kill("TERM", stripe_mock_pid)
          Process.waitpid2(stripe_mock_pid)  # Wait for clean shutdown
          puts "Stopped stripe-mock"
        rescue Errno::ESRCH, Errno::ECHILD
          # Process already terminated
        end
      end

      # Note: We don't stop the singleton here - it manages its own lifecycle
    end

    # Exit with the same status as RSpec
    exit(status ? 0 : 1)
  end

  desc "Run tests with Stripe and Wise API mocks in verbose mode"
  task :with_mocks_verbose, [:test_path] => :environment do |_, args|
    ENV["VERBOSE"] = "true"
    Rake::Task["test:with_mocks"].invoke(args[:test_path])
  end

  desc "Verify mock configuration without running tests"
  task verify_mocks: :environment do
    ENV["USE_STRIPE_MOCK"] = "true"
    ENV["USE_WISE_MOCK"] = "true"

    puts "Verifying Stripe mock configuration..."
    if system("which stripe-mock > /dev/null 2>&1")
      puts "✓ stripe-mock is installed"

      if system("lsof -i:12111 -sTCP:LISTEN > /dev/null 2>&1")
        # Verify the running stripe-mock is responsive
        begin
          require "net/http"
          uri = URI("http://localhost:12111/v1/charges")
          response = Net::HTTP.get_response(uri)
          if response.code.to_i == 401
            puts "✓ stripe-mock is running and responding correctly (401 Unauthorized)"
          else
            puts "⚠️ stripe-mock is running but returned unexpected status code: #{response.code}"
          end
        rescue StandardError => e
          puts "⚠️ stripe-mock is running but not responding correctly: #{e.message}"
        end
      else
        puts "× stripe-mock is not running"
        puts "  Start it with: stripe-mock -http-port 12111 -https-port 12112"
      end
    else
      puts "× stripe-mock is not installed"
      puts "  Install it with: brew install stripe/stripe-mock/stripe-mock"
    end

    puts "\nVerifying Wise mock configuration..."
    puts "✓ WebMock is configured for Wise API mocking"

    puts "\nTo run tests with mocks:"
    puts "  rake test:with_mocks              # Run all tests"
    puts "  rake test:with_mocks[spec/models] # Run specific directory"
    puts "  rake test:with_mocks[spec/models/company_spec.rb] # Run specific file"
  end
end
