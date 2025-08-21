# frozen_string_literal: true

WISE_API_KEY = ENV["WISE_API_KEY"].presence || "dummy"
WISE_PROFILE_ID = ENV["WISE_PROFILE_ID"].presence || "dummy"
WISE_API_URL = Rails.env.production? ? "https://api.transferwise.com" : "https://api.sandbox.transferwise.tech"
