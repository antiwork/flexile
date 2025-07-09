# frozen_string_literal: true

class Internal::Companies::InvoicesController < Internal::Companies::BaseController
  before_action :load_invoice!, only: [:edit, :update]
  before_action :authorize_invoices_for_rejection, only: [:reject]
  before_action :authorize_invoices_for_approval_and_pay, only: [:approve]

  def new
    authorize Invoice

    invoice = Invoice.new(user: Current.user, company: Current.company)
    render json: InvoicePresenter.new(invoice).new_form_props(contractor: Current.company_worker)
  end

  def create
    authorize Invoice

    result = CreateOrUpdateInvoiceService.new(
      params:,
      user: Current.user,
      company: Current.company,
      contractor: Current.company_worker,
    ).process

    if result[:success]
      head :created
    else
      render json: { error_message: result[:error_message] }, status: :unprocessable_entity
    end
  end

  def edit
    authorize @invoice

    render json: InvoicePresenter.new(@invoice).edit_form_props(contractor: Current.company_worker)
  end

  def update
    authorize @invoice

    result = CreateOrUpdateInvoiceService.new(
      params:,
      user: Current.user,
      company: Current.company,
      contractor: Current.company_worker,
      invoice: @invoice,
    ).process

    if result[:success]
      head :no_content
    else
      render json: { error_message: result[:error_message] }, status: :unprocessable_entity
    end
  end

  def microdeposit_verification_details
    authorize Invoice

    company = Current.company
    details = company.microdeposit_verification_details if company.microdeposit_verification_required?
    render json: { details: }
  end

  def export
    authorize Invoice

    body = InvoiceCsv.new(Current.company.invoices.alive.order(created_at: :asc)).generate
    response.headers["Content-Disposition"] = "attachment; filename=invoices-#{Time.current.strftime("%Y-%m-%d_%H%M%S")}.csv"
    render body:, content_type: "text/csv"
  end

  def approve
    authorize Invoice

    if invoice_external_ids_for_approval.present?
      ApproveManyInvoices.new(
        company: Current.company,
        approver: Current.user,
        invoice_ids: invoice_external_ids_for_approval,
      ).perform
    end
    if invoice_external_ids_for_payment.present?
      ApproveAndPayOrChargeForInvoices.new(
        user: Current.user,
        company: Current.company,
        invoice_ids: invoice_external_ids_for_payment
      ).perform
    end
  end

  def reject
    authorize Invoice

    RejectManyInvoices.new(
      company: Current.company,
      rejected_by: Current.user,
      invoice_ids: invoice_external_ids_for_rejection,
      reason: params[:reason].presence,
    ).perform
  end

  def destroy
    invoice = Current.user.invoices.alive.find_by!(external_id: params[:id])
    authorize invoice
    invoice.mark_deleted!

    head :no_content
  end

  private
    def load_invoice!
      @invoice = Current.user.invoices.alive.find_by!(external_id: params[:id])
    end

    def authorize_invoices_for_rejection
      all_invoices_belong_to_company = invoice_external_ids_for_rejection.all? do |invoice_external_id|
        Current.company.invoices.alive.exists?(external_id: invoice_external_id)
      end

      unless all_invoices_belong_to_company
        e404
      end
    end

    def authorize_invoices_for_approval_and_pay
      ids = invoice_external_ids_for_approval + invoice_external_ids_for_payment
      all_invoices_belong_to_company = ids.all? do |invoice_id|
        Current.company.invoices.alive.exists?(external_id: invoice_id)
      end

      unless all_invoices_belong_to_company
        e404
      end
    end

    def invoice_external_ids_for_rejection
      params.require(:ids)
    end

    def approve_params
      params.permit(approve_ids: [], pay_ids: [])
    end

    def invoice_external_ids_for_approval
      approve_params[:approve_ids] || []
    end

    def invoice_external_ids_for_payment
      approve_params[:pay_ids] || []
    end

    def user_not_authorized(_)
      if params[:action].in? %w[edit update]
        json_redirect "/invoices/#{@invoice.external_id}"
      elsif params[:action].in? %w[new create]
        json_redirect "/invoices"
      else
        super
      end
    end
end
