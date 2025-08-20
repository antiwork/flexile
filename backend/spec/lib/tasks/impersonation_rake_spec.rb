# frozen_string_literal: true

require "rails_helper"
require "rake"

RSpec.describe "impersonation:generate_url", type: :task do
  let(:user) { create(:user, email: "test@example.com", legal_name: "John Doe") }

  before do
    Rails.application.load_tasks if Rake::Task.tasks.empty?
    Rails.application.config.action_mailer.default_url_options = { host: "flexile.co" }
  end

  it "generates impersonation URL for valid user" do
    expect { invoke_task("impersonation:generate_url", user.email) }.to output(
      /Impersonation URL for John Doe \(test@example\.com\):\nhttps:\/\/flexile\.co\/admin\/impersonate\?token=.*\n\nNote: URL expires in 5 minutes\nOnly accessible by team members/
    ).to_stdout
  end

  it "shows error for non-existent user" do
    expect { invoke_task("impersonation:generate_url", "nonexistent@example.com") }.to output(
      "Error: User with email 'nonexistent@example.com' not found\n"
    ).to_stdout.and raise_error(SystemExit)
  end

  it "shows usage when email is blank" do
    expect { invoke_task("impersonation:generate_url", "") }.to output(
      "Usage: rails impersonation:generate_url[user@example.com]\n"
    ).to_stdout.and raise_error(SystemExit)
  end

  it "shows error when host is not configured" do
    Rails.application.config.action_mailer.default_url_options = {}

    expect { invoke_task("impersonation:generate_url", user.email) }.to output(
      "Error: action_mailer.default_url_options[:host] not configured\nSet in config/environments/#{Rails.env}.rb or via environment variable\n"
    ).to_stdout.and raise_error(SystemExit)
  end

  private

    def invoke_task(task_name, *args)
      task = Rake::Task[task_name]
      task.reenable
      task.invoke(*args)
    end
end
