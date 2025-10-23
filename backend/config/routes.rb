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
  end

  scope module: :api, as: :api do
    namespace :helper do
      resource :users, only: :show
    end
  end

  resource :oauth_redirect, only: :show

  def spa_controller_action
    "application#main_vue"
  end

  get "up", to: "rails/health#show"
end
