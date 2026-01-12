# frozen_string_literal: true

module Internal
  class GithubController < BaseController
    def pull_request
      token = request.headers["X-Github-Access-Token"]
      service = GithubService.new(token: token)

      result = service.fetch_pull_request(
        url: params[:url],
        invoice_id: params[:invoice_id],
        company_id: params[:company_id],
        user: current_user
      )

      if result.nil?
        render json: nil
      elsif result.error
        render json: { error: result.error, owner: result.owner, repo: result.repo, number: result.number, isPaid: result.is_paid, type: result.type }
      else
        render json: {
          id: result.id,
          title: result.title,
          state: result.state,
          merged: result.merged,
          html_url: result.html_url,
          number: result.number,
          owner: result.owner,
          repo: result.repo,
          bountyAmount: result.bounty_amount,
          author: result.author,
          isPaid: result.is_paid,
          isVerified: result.is_verified,
          type: result.type,
        }
      end
    end
  end
end
