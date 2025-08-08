# frozen_string_literal: true

if defined?(Sidekiq::Pro)
  require "sidekiq/pro/web"
else
  require "sidekiq/web"
end
require "sidekiq/cron/web"

admin_constraint = lambda do |request|
  user = JwtService.user_from_request(request)
  user&.team_member?
end

api_domain_constraint = lambda do |request|
  Rails.env.test? || API_DOMAIN == request.host
end

Rails.application.routes.draw do
  namespace :admin, constraints: admin_constraint do
    resources :company_workers
    resources :company_administrators
    resources :companies
    resources :users
    resources :payments do
      member do
        patch :wise_paid
        patch :wise_funds_refunded
        patch :wise_charged_back
      end
    end
    resources :invoices
    resources :consolidated_invoices, only: [:index, :show]
    resources :consolidated_payments, only: [:index, :show] do
      member do
        post :refund
      end
    end

    mount Sidekiq::Web, at: "/sidekiq"
    mount Flipper::UI.app(Flipper) => "/flipper"

    root to: "users#index"
  end

  devise_for(:users, skip: :all)

  # Internal API consumed by the front-end SPA
  # All new routes should be added here moving forward
  draw(:internal)

  namespace :webhooks do
    resources :wise, controller: :wise, only: [] do
      collection do
        post :transfer_state_change
        post :balance_credit
      end
    end

    resources :stripe, controller: :stripe, only: [:create]
    resources :quickbooks, controller: :quickbooks, only: [:create]
  end

  scope module: :api, as: :api do
    constraints api_domain_constraint do
      namespace :v1 do
      end
      namespace :helper do
        resource :users, only: :show
      end
    end
  end

  # Old routes for backwards compatibility. Can be removed after Jan 1, 2025
  get "/company/settings", to: redirect { |_path, req| "/companies/_/settings/administrator#{req.query_string.present? ? "?#{req.query_string}" : ""}" }
  get "/company/details", to: redirect("/companies/_/settings/administrator/details")
  get "/company/billing", to: redirect("/companies/_/settings/administrator/billing")
  get "/expenses", to: redirect("/companies/_/expenses")
  get "/investors/:id", to: redirect { |path_params, req| "/companies/_/investors/#{path_params[:id]}#{req.query_string.present? ? "?#{req.query_string}" : ""}" }
  get "/invoices", to: redirect("/companies/_/invoices")
  get "/invoices/new", to: redirect("/companies/_/invoices/new")
  get "/invoices/:id/edit", to: redirect("/companies/_/invoices/%{id}/edit")
  get "/people", to: redirect("/companies/_/people")
  get "/people/new", to: redirect { |_path_params, req| "/companies/_/people/new#{req.query_string.present? ? "?#{req.query_string}" : ""}" }
  get "/internal/userid", to: "application#userid"
  get "/internal/current_user_data", to: "application#current_user_data"
  get "/companies/:company_id/settings/equity", to: redirect("/settings/equity")
  resource :oauth_redirect, only: :show

  def spa_controller_action
    "application#main_vue"
  end
end
