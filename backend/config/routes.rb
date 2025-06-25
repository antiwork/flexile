# frozen_string_literal: true

if defined?(Sidekiq::Pro)
  require "sidekiq/pro/web"
else
  require "sidekiq/web"
end
require "sidekiq/cron/web"

admin_constraint = lambda do |request|
  request.env["clerk"].user? && User.find_by(clerk_id: request.env["clerk"].user_id)&.team_member?
end

api_domain_constraint = lambda do |request|
  Rails.env.test? || API_DOMAIN == request.host
end

Rails.application.routes.draw do
  namespace :admin, constraints: admin_constraint do
    resources :company_workers
    resources :company_administrators
    resources :companies
    resources :time_entries
    resources :users
    resources :user_leads
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
        resources :user_leads, only: :create
      end
      namespace :helper do
        resource :users, only: :show
      end
    end
  end

  # Old routes for backwards compatibility. Can be removed after Jan 1, 2025
  get "/company/settings", to: redirect { |_path, req| "/companies/_/administrator/settings#{req.query_string.present? ? "?#{req.query_string}" : ""}" }
  get "/company/details", to: redirect("/companies/_/administrator/settings/details")
  get "/company/billing", to: redirect("/companies/_/administrator/settings/billing")
  get "/expenses", to: redirect("/companies/_/expenses")
  get "/investors/:id", to: redirect { |path_params, req| "/companies/_/investors/#{path_params[:id]}#{req.query_string.present? ? "?#{req.query_string}" : ""}" }
  get "/invoices", to: redirect("/companies/_/invoices")
  get "/invoices/new", to: redirect("/companies/_/invoices/new")
  get "/invoices/:id/edit", to: redirect("/companies/_/invoices/%{id}/edit")
  get "/people", to: redirect("/companies/_/people")
  get "/people/new", to: redirect { |_path_params, req| "/companies/_/people/new#{req.query_string.present? ? "?#{req.query_string}" : ""}" }
  get "/onboarding/invitation", to: redirect { |path_params, req| "/companies/_/worker/onboarding/invitation#{path_params[:id]}#{req.query_string.present? ? "?#{req.query_string}" : ""}" }
  get "/onboarding/contract", to: redirect("/companies/_/worker/onboarding/contract")
  get "/investor_onboarding", to: redirect("/companies/_/investor/onboarding")
  get "/investor_onboarding/invitation", to: redirect { |path_params, req| "/companies/_/investor/onboarding/invitation#{path_params[:id]}#{req.query_string.present? ? "?#{req.query_string}" : ""}" }
  get "/investor_onboarding/legal", to: redirect("/companies/_/investor/onboarding/legal")
  get "/investor_onboarding/bank_account", to: redirect("/companies/_/investor/onboarding/bank_account")
  get "/lawyer_onboarding/invitation", to: redirect { |path_params, req| "/companies/_/lawyer/onboarding/invitation#{path_params[:id]}#{req.query_string.present? ? "?#{req.query_string}" : ""}" }
  get "/internal/userid", to: "application#userid"
  get "/internal/current_user_data", to: "application#current_user_data"
  get "/companies/:company_id/settings/equity", to: redirect("/settings/equity")
  resource :oauth_redirect, only: :show

  def spa_controller_action
    "application#main_vue"
  end

  scope as: :spa do
    with_options to: spa_controller_action do
      resource :settings, only: :show, to: "application#main_vue"
      resources :invoices, only: :index, to: "application#main_vue"
      resource :onboarding, only: :show, to: "application#main_vue" do
        resource :legal, only: :show, to: "application#main_vue"
        resource :bank_account, only: :show, to: "application#main_vue"
      end

      resources :companies, only: [] do
        # Accessible by company administrator
        namespace :administrator, module: nil do
          namespace :onboarding, module: nil do
            resource :invitation, only: :show, to: "application#main_vue"
            resource :details, only: :show, to: "application#main_vue"
            resource :bank_account, only: :show, to: "application#main_vue"
          end
        end

        namespace :worker, module: nil do
          resource :onboarding, only: :show, to: "application#main_vue" do
            resource :invitation, only: :show, to: "application#main_vue"
            resource :legal, only: :show, to: "application#main_vue"
            resource :bank_account, only: :show, to: "application#main_vue"
            resource :contract, only: :show, to: "application#main_vue"
          end
        end

        namespace :investor, module: nil do
          resource :onboarding, only: :show, to: "application#main_vue" do
            resource :invitation, only: :show, to: "application#main_vue"
            resource :legal, only: :show, to: "application#main_vue"
            resource :bank_account, only: :show, to: "application#main_vue"
          end
        end

        namespace :lawyer, module: nil do
          namespace :onboarding, module: nil do
            resource :invitation, only: :show, to: "application#main_vue"
          end
        end

        resources :expenses, only: :index, to: "application#main_vue"
        resources :invoices, only: :index, to: "application#main_vue"
      end
    end
  end
end
