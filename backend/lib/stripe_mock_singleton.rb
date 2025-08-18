# frozen_string_literal: true

require "singleton"
require "net/http"

# Singleton class for managing stripe-mock server lifecycle
# Based on the official Stripe Ruby SDK approach
# https://github.com/stripe/stripe-ruby/blob/master/test/stripe_mock.rb
module Stripe
  class StripeMock
    include Singleton

    # Class variables for process management
    @pid = nil
    @port = nil
    @stdout = nil
    @stderr = nil
    @child_stdout = nil
    @child_stderr = nil

    class << self
      attr_reader :pid, :port

      # Starts stripe-mock if necessary. Returns the port on which stripe-mock is listening.
      def start
        return @port unless @pid.nil?

        # Check if stripe-mock is installed
        unless system("which stripe-mock > /dev/null 2>&1")
          puts "Error: stripe-mock is not installed. Please install it with:"
          puts "  brew install stripe/stripe-mock/stripe-mock"
          puts "  or"
          puts "  go install github.com/stripe/stripe-mock@latest"
          raise "stripe-mock not found"
        end

        # Use environment variable or default port
        requested_port = ENV["STRIPE_MOCK_PORT"] || "12111"

        # Check if stripe-mock is already running on the requested port
        if port_in_use?(requested_port)
          puts "🔌 stripe-mock already running on port #{requested_port}"
          @port = requested_port.to_i
          return @port
        end

        puts "🚀 Starting stripe-mock..."

        # Create IO pipes for output (following official SDK pattern)
        @stdout, @child_stdout = IO.pipe
        @stderr, @child_stderr = IO.pipe

        # Start stripe-mock process
        # Use port 0 to let stripe-mock select an available port dynamically
        # This prevents port conflicts and follows the official SDK approach
        @pid = Process.spawn(
          "stripe-mock",
          "-http-port", requested_port,
          "-https-port", (requested_port.to_i + 1).to_s,
          out: @child_stdout,
          err: @child_stderr
        )

        # Close child sides of pipes in parent process
        @child_stdout.close
        @child_stderr.close

        # Wait for server to be ready and detect port
        @port = wait_for_server(requested_port.to_i)

        puts "✅ stripe-mock started successfully (PID: #{@pid}, Port: #{@port})"

        # Set up cleanup on exit
        at_exit { stop }

        @port
      rescue StandardError => e
        puts "❌ Failed to start stripe-mock: #{e.message}"
        cleanup_on_error
        raise
      end

      # Stops stripe-mock if necessary
      def stop
        return if @pid.nil?

        puts "🛑 Stopping stripe-mock (PID: #{@pid})..."
        begin
          Process.kill("TERM", @pid)
          Process.waitpid2(@pid)
          puts "✅ stripe-mock stopped successfully"
        rescue Errno::ESRCH, Errno::ECHILD
          puts "⚠️  stripe-mock process already terminated"
        ensure
          cleanup
        end
      end

      # Check if stripe-mock is running
      def running?
        !@pid.nil? && process_alive?(@pid)
      end

      # Reset singleton state (useful for testing)
      def reset!
        stop
        cleanup
      end

      private
        # Clean up resources
        def cleanup
          @pid = nil
          @port = nil
          [@stdout, @stderr].compact.each(&:close) rescue nil
          @stdout = nil
          @stderr = nil
        end

        # Clean up on error
        def cleanup_on_error
          if @pid
            Process.kill("TERM", @pid) rescue nil
            Process.waitpid2(@pid) rescue nil
          end
          cleanup
        end

        # Check if a process is still alive
        def process_alive?(pid)
          Process.kill(0, pid)
          true
        rescue Errno::ESRCH
          false
        end

        # Check if port is in use
        def port_in_use?(port)
          uri = URI("http://localhost:#{port}/v1/charges")
          response = Net::HTTP.get_response(uri)
          # stripe-mock returns 401 when no auth is provided
          response.code.to_i == 401
        rescue StandardError
          false
        end

        # Wait for server to be ready with exponential backoff
        def wait_for_server(port, max_attempts: 30, initial_delay: 0.1)
          attempts = 0
          delay = initial_delay

          while attempts < max_attempts
            if port_in_use?(port)
              # Server is ready
              return port
            end

            attempts += 1
            sleep(delay)
            delay = [delay * 1.5, 2.0].min # Cap at 2 seconds
          end

          raise "stripe-mock failed to start after #{max_attempts} attempts"
        end
    end

    # Instance methods for Singleton compatibility
    def start
      self.class.start
    end

    def stop
      self.class.stop
    end

    def running?
      self.class.running?
    end

    def port
      self.class.port
    end

    def pid
      self.class.pid
    end
  end
end
