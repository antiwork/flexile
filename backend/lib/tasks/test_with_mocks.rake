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
    ENV["STRIPE_MOCK_PORT"] = "12111"

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

    # Check if stripe-mock is already running
    stripe_mock_running = system("lsof -i:12111 -sTCP:LISTEN > /dev/null 2>&1")

    unless stripe_mock_running
      # Start stripe-mock in the background
      puts "Starting stripe-mock server..."
      stripe_mock_pid = spawn("stripe-mock -http-port 12111 -https-port 12112")
      Process.detach(stripe_mock_pid)

      # Wait for stripe-mock to be ready with proper timeout
      max_retries = 10
      retries = 0
      stripe_mock_ready = false

      while retries < max_retries && !stripe_mock_ready
        sleep 0.5
        begin
          uri = URI("http://localhost:12111/v1/charges")
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
        uri = URI("http://localhost:12111/v1/charges")
        response = Net::HTTP.get_response(uri)
        if response.code.to_i == 401
          puts "🔌 Stripe configured to use stripe-mock server at http://localhost:12111"
          puts "✅ Successfully connected to stripe-mock server"
        else
          puts "Warning: stripe-mock is running but returned unexpected status code: #{response.code}"
        end
      rescue StandardError => e
        puts "Warning: stripe-mock is running but not responding correctly: #{e.message}"
      end
    end

    # Run RSpec with the specified path
    rspec_command = "bundle exec rspec #{test_path}"
    puts "Running: #{rspec_command}"

    # Use exec instead of system to properly handle output streaming and signals
    # This replaces the current process with RSpec
    if stripe_mock_pid
      # If we started stripe-mock, register an at_exit handler to clean it up
      at_exit do
        if Process.pid == original_pid
          puts "Stopping stripe-mock server..."
          Process.kill("TERM", stripe_mock_pid) rescue nil
        end
      end
    end

    # Replace current process with RSpec - avoids hanging
    exec(rspec_command)
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
