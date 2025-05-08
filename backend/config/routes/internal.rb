# frozen_string_literal: true

# Note: Route helpers don't have `internal_` prefix
scope path: :internal, module: :internal do
  namespace :demo do
    resources :companies, only: :show
  end

  namespace :settings do
    resource :dividend, only: [:show, :update], controller: "dividend"
    resource :tax, only: [:show, :update], controller: "tax"
    resources :bank_accounts, only: [:index, :update]
  end
  resource :onboarding, controller: "onboarding", only: [:show, :update] do
    get :bank_account
    patch :save_bank_account
  end

  resources :roles, only: [:index, :show]

  # Company portal routes
  resources :companies, only: [], module: :companies do
    # Accessible by company administrator
    namespace :administrator do
      resource :onboarding, only: [:update], controller: "onboarding" do
        get :details
        get :bank_account
        patch :added_bank_account
      end

      namespace :settings do
        resource :equity, only: [:show, :update], controller: "equity"
      end

      resources :quickbooks, only: :update do
        collection do
          get :connect
          delete :disconnect
          get :list_accounts
        end
      end
      resource :github, only: [:create, :destroy]
      resources :stripe_microdeposit_verifications, only: :create
      resources :equity_grants, only: [:create]
    end

    resource :switch, only: :create, controller: "switch"

    resources :company_updates do
      post :send_test_email, on: :member
    end
    resources :workers, only: [:create]
    resources :lawyers, only: [:create]
    resources :equity_grant_exercises, only: :create do
      member do
        post :resend
      end
    end
    resources :equity_exercise_payments, only: :update
    resources :invoices, except: [:index, :show, :destroy] do
      collection do
        patch :approve
        patch :reject
        get :export
        get :microdeposit_verification_details
      end
    end
    resources :quickbooks, only: :update do
      collection do
        get :connect
        delete :disconnect
      end
    end
    resources :roles, only: [:index, :create, :update, :destroy]
  end

  resources :wise_account_requirements, only: :create
  resources :company_invitations, only: [:create]
end
