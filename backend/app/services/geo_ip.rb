# frozen_string_literal: true

class GeoIp
  GEO_IP = MaxMind::GeoIP2::Reader.new(database: Rails.root.join("lib", "GeoIP2-Country.mmdb").to_s)

  class Result
    attr_reader :country_name, :country_code

    def initialize(country_name:, country_code:)
      @country_name = country_name
      @country_code = country_code
    end
  end

  def self.lookup(ip)
    result = GEO_IP.country(ip) rescue nil
    return nil if result.nil?

    Result.new(
      country_name: santitize_string(result.country.name),
      country_code: santitize_string(result.country.iso_code)
    )
  end

  def self.santitize_string(value)
    value.try(:encode, "UTF-8", invalid: :replace, replace: "?")
  rescue Encoding::UndefinedConversionError
    "INVALID"
  end
end
