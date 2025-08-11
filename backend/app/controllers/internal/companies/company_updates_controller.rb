# frozen_string_literal: true

class Internal::Companies::CompanyUpdatesController < Internal::Companies::BaseController
  before_action :load_company_update!, only: [:show, :edit, :update, :destroy, :send_test_email]


  def index
    authorize CompanyUpdate

    presenter = CompanyUpdatesPresenter.new(
      company: Current.company,
      params:
    )
    render json: Current.company_administrator? ? presenter.admin_props : presenter.props
  end

  def new
    authorize CompanyUpdate

    render json: CompanyUpdatePresenter.new(Current.company.company_updates.build).form_props
  end

  def edit
    authorize @company_update

    render json: CompanyUpdatePresenter.new(@company_update).form_props
  end

  def create
    authorize CompanyUpdate

    result = CreateOrUpdateCompanyUpdate.new(company: Current.company, company_update_params:).perform!
    result = PublishCompanyUpdate.new(result[:company_update]).perform! if params[:publish] == "true"

    render json: { company_update: CompanyUpdatePresenter.new(result[:company_update]).props }, status: :created
  rescue ActiveRecord::RecordInvalid => error
    Bugsnag.notify("Error creating company update: #{error}")
    render json: { error_message: error.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end

  def update
    authorize @company_update

    CreateOrUpdateCompanyUpdate.new(company: Current.company, company_update: @company_update, company_update_params:).perform!
    PublishCompanyUpdate.new(@company_update).perform! if params[:publish] == "true"

    render json: { company_update: CompanyUpdatePresenter.new(@company_update).props }, status: :ok
  rescue ActiveRecord::RecordInvalid => error
    Bugsnag.notify("Error updating company update: #{error}")
    render json: { error_message: error.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end

  def send_test_email
    authorize @company_update
    CompanyUpdateMailer.update_published(company_update_id: @company_update.id, user_id: Current.user.id).deliver_now
    head :ok
  end

  def show
    authorize @company_update
    render json: CompanyUpdatePresenter.new(@company_update).props
  end

  def destroy
    authorize @company_update
    @company_update.destroy!
    head :no_content
  end

  private
    def load_company_update!
      @company_update = Current.company.company_updates.find_by!(external_id: params[:id])
    end

    def company_update_params
      params
        .require(:company_update)
        .permit(:title, :body, :period, :period_started_on, :show_revenue, :show_net_income)
    end
end
