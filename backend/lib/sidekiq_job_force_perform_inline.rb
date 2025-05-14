# frozen_string_literal: true

# Overrides perform_async and perform_in to force inline execution of jobs
# Only for jobs in the list of SidekiqJobForcePerformInline.force_inline_class_names
#
# Usage:
# class MyClass
#   def initialize
#   end
#
#   def perform
#     SidekiqJobForcePerformInline.force_inline_class_names = [
#       MyJob
#     ]
#     SidekiqJobForcePerformInline.apply
#     # Code that executes some jobs
#   ensure
#     SidekiqJobForcePerformInline.revert
#   end
# end

module SidekiqJobForcePerformInline
  @force_inline_class_names = []
  @original_module = nil

  class << self
    attr_accessor :force_inline_class_names

    def apply
      @original_module = Sidekiq::Job::ClassMethods.dup
      Sidekiq::Job::ClassMethods.prepend(CustomPerformMethods)
    end

    def revert
      return unless @original_module

      Sidekiq::Job::ClassMethods.prepend(@original_module)
      @original_module = nil
    end
  end
  module CustomPerformMethods
    %i[perform_async perform_in].each do |method_name|
      define_method(method_name) do |*args|
        args = method_name == :perform_in ? args[1..-1] : args
        if SidekiqJobForcePerformInline.force_inline_class_names.include?(name.constantize)
          Rails.logger.debug("SidekiqJobForcePerformInline: force inline for #{name}")
          perform_inline(*args)
        else
          super(*args)
        end
      end
    end
  end
end
