# frozen_string_literal: true

raw_countries = JSON.load_file("#{Rails.root}/config/countries.json")
COUNTRY_CODES = raw_countries.keys
SUPPORTED_COUNTRY_CODES = raw_countries.select { |_, v| v["supportsWisePayout"] }.keys
SANCTIONED_COUNTRY_CODES = raw_countries.select { |_, v| v["sanctioned"] }.keys
TAX_TREATY_COUNTRY_CODES = raw_countries.select { |_, v| v["hasTaxTreaty"] }.keys
