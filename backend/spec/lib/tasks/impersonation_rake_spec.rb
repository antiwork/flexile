# frozen_string_literal: true

require 'spec_helper'
require 'rake'

RSpec.describe "impersonation:generate_url", type: :task do
  let(:user) { create(:user, email: "test@example.com", legal_name: "Test User") }

  before do
    Rake.application.rake_require "tasks/impersonation"
    Rake::Task.define_task(:environment)
  end

  describe "impersonation:generate_url" do
    let(:task) { Rake::Task["impersonation:generate_url"] }

    after do
      task.reenable
    end

    context "with valid email" do
      it "generates impersonation URL" do
        expect { task.invoke(user.email) }.to output(/Impersonation URL generated for #{user.display_name}/).to_stdout
      end

      it "includes the impersonation URL in output" do
        expect { task.invoke(user.email) }.to output(/http.*impersonate\?token=/).to_stdout
      end

      it "includes expiry information" do
        expect { task.invoke(user.email) }.to output(/This URL will expire in 5 minutes/).to_stdout
      end
    end

    context "with invalid email" do
      it "shows error for non-existent user" do
        expect { task.invoke("nonexistent@example.com") }.to output(/Error: User with email 'nonexistent@example.com' not found/).to_stdout
      end

      it "exits with status 1" do
        expect { task.invoke("nonexistent@example.com") }.to raise_error(SystemExit) do |error|
          expect(error.status).to eq(1)
        end
      end
    end

    context "with missing email" do
      it "shows usage error" do
        expect { task.invoke }.to output(/Error: Email is required/).to_stdout
      end

      it "shows usage instructions" do
        expect { task.invoke }.to output(/Usage: rails impersonation:generate_url\[user@example.com\]/).to_stdout
      end

      it "exits with status 1" do
        expect { task.invoke }.to raise_error(SystemExit) do |error|
          expect(error.status).to eq(1)
        end
      end
    end
  end
end
