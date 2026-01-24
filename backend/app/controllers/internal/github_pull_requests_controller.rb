# frozen_string_literal: true

class Internal::GithubPullRequestsController < Internal::BaseController
  # POST /internal/github_pull_requests/fetch
  def fetch
    url = params[:url]
    company_id = params[:company_id]
    target_username = params[:target_username]

    company = Company.find_by!(external_id: company_id)
    github_service = GithubApiService.for_company(company)

    begin
      pr_details = github_service.fetch_pr_details(url: url, github_username: target_username)

      repo_path = "#{pr_details[:repository]}"
      pr_number = pr_details[:number]
      prettified_prefix = "[#{repo_path} ##{pr_number}]"
      url_regex = "#{Regexp.escape(url)}(?![0-9])"

      paid_invoices_data = Invoice.joins(:invoice_line_items)
                                  .where(company: company, status: :paid)
                                  .where("invoice_line_items.description ~* ? OR invoice_line_items.description LIKE ?", url_regex, "%#{prettified_prefix}%")
                                  .distinct
                                  .pluck(:invoice_number, :external_id)

      render json: {
        success: true,
        pr: pr_details.merge(
          already_paid: paid_invoices_data.any?,
          paid_invoice_numbers: paid_invoices_data.map { |number, id| { invoice_number: number, external_id: id } },
          belongs_to_company: github_service.using_installation?,
          needs_connection: false
        ),
      }
    rescue GithubApiService::InvalidUrlError => e
      render json: { success: false, error: e.message }, status: :bad_request
    rescue GithubApiService::UnauthorizedError => e
      render json: { success: false, error: e.message, needs_connection: true }, status: :unauthorized
    rescue GithubApiService::ApiError => e
      status = e.message.include?("not found") ? :not_found : :service_unavailable
      render json: { success: false, error: e.message }, status: status
    rescue => e
      Rails.logger.error("[GithubPullRequestsController] Unexpected error: #{e.message}")
      render json: { success: false, error: "Failed to fetch PR details" }, status: :internal_server_error
    end
  end
end
