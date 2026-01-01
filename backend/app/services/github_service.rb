# frozen_string_literal: true

class GithubService
  BASE_URL = "https://api.github.com"

  def initialize(access_token = nil)
    @access_token = access_token
  end

  def fetch_pr(owner, repo, number)
    make_request("/repos/#{owner}/#{repo}/pulls/#{number}")
  end

  def fetch_issue(owner, repo, number)
    make_request("/repos/#{owner}/#{repo}/issues/#{number}")
  end

  def fetch_user
    make_request("/user")
  end

  def fetch_organization(org)
    make_request("/orgs/#{org}")
  end

  private

  def make_request(path)
    uri = URI("#{BASE_URL}#{path}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true

    request = Net::HTTP::Get.new(uri)
    request["Authorization"] = "Bearer #{@access_token}" if @access_token
    request["Accept"] = "application/vnd.github+json"
    request["X-GitHub-Api-Version"] = "2022-11-28"

    response = http.request(request)
    return nil unless response.is_a?(Net::HTTPSuccess)

    JSON.parse(response.body)
  rescue JSON::ParserError, Net::HTTPError
    nil
  end
end