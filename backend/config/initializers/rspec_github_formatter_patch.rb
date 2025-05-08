# frozen_string_literal: true

if ENV["CI"].present?
  require "rspec/github"
  module RSpec
    module Github
      class Formatter
        def example_pending(_pending)
          # Disable annotations for pending specs
        end
      end
    end
  end
end
