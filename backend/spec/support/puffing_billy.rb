# frozen_string_literal: true

# Ref: https://github.com/oesmith/puffing-billy/issues/253#issuecomment-539710620
# A patch to `puffing-billy`'s proxy so that it doesn't try to stop
# eventmachine's reactor if it's not running.
module BillyProxyPatch
  def stop
    return unless EM.reactor_running?
    super
  end
end
Billy::Proxy.prepend(BillyProxyPatch)

# A patch to `puffing-billy` to start EM if it has been stopped
Billy.module_eval do
  def self.proxy
    if @billy_proxy.nil? || !(EventMachine.reactor_running? && EventMachine.reactor_thread.alive?)
      proxy = Billy::Proxy.new
      proxy.start
      @billy_proxy = proxy
    else
      @billy_proxy
    end
  end
end

if ENV["KNAPSACK_PRO_TEST_SUITE_TOKEN_RSPEC"].present?
  KnapsackPro::Hooks::Queue.before_queue do
    # executes before Queue Mode starts work
    Billy.proxy.start
  end

  KnapsackPro::Hooks::Queue.after_queue do
    # executes after Queue Mode finishes work
    Billy.proxy.stop
  end
end
