# frozen_string_literal: true

# Note: Route helpers don't have `internal_` prefix
scope path: :internal, module: :internal do
  resources :login, only: :create
  resources :email_otp, only: :create
  resources :signup, only: [] do
    collection do
      post :send_otp
      post :verify_and_create
    end
  end

  namespace :demo do
    resources :companies, only: :show
  end

  resource :settings, only: [:update]
  namespace :settings do
    resource :dividend, only: [:show, :update], controller: "dividend"
    resource :tax, only: [:show, :update], controller: "tax"
    resources :bank_accounts, only: [:index, :create, :update]
    resource :equity, only: [:update], controller: "equity"
  end

  resources :roles, only: [:index, :show]

  # Company portal routes
  resources :companies, only: [], module: :companies do
    # Accessible by company administrator
    namespace :administrator do
      namespace :settings do
        resource :equity, only: [:show, :update], controller: "equity"
        resource :bank_accounts, only: [:show, :create], controller: "bank_accounts"
      end

      resources :quickbooks, only: :update do
        collection do
          get :connect
          delete :disconnect
          get :list_accounts
        end
      end
      resources :stripe_microdeposit_verifications, only: :create
      resources :equity_grants, only: [:create]
    end

    resource :switch, only: :create, controller: "switch"
    resource :leave, only: [:destroy], controller: "leave_company"

    resources :company_updates do
      post :send_test_email, on: :member
    end
    resources :workers, only: [:create]
    resources :lawyers, only: [:create]
    resources :administrators, only: [:create]
    resources :users, only: [:index] do
      collection do
        post :add_role
        post :remove_role
      end
    end
    resources :equity_grant_exercises, only: :create do
      member do
        post :resend
      end
    end
    resources :equity_exercise_payments, only: :update
    resources :invoices, except: [:index, :show] do
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

    resources :invite_links, only: [] do
      collection do
        get :show
        patch :reset
      end
    end

    resources :dividends, only: [:show] do
      member do
        post :sign
      end
    end
  end

  resources :wise_account_requirements, only: :create
  resources :company_invitations, only: [:create]

  resources :invite_links, only: [] do
    post :verify, on: :collection
    post :accept, on: :collection
  end
end
