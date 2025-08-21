# frozen_string_literal: true

class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class

  def self.public_bucket
    Rails.env.test? ? :test_public : ENV["AWS_ACCESS_KEY_ID"].present? ? :amazon_public : :local
  end
end
