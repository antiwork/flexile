# frozen_string_literal: true

class Internal::Companies::TemplatesController < Internal::Companies::BaseController
  after_action :verify_authorized

  def index
    authorize :document_templates
    render json: Current.company.document_templates.map { |template| template.as_json(only: [:name, :document_type, :updated_at]) }
  end

  def show
    authorize :document_templates
    render json: Current.company.document_templates.find_by(document_type: params[:id]).as_json(only: [:text])
  end

  def update
    authorize :document_templates
    if params[:text].present?
      template = Current.company.document_templates.find_or_initialize_by(document_type: params[:id])
      template.update!(text: params[:text])
    else
      Current.company.document_templates.where(document_type: params[:id]).destroy_all
    end
    head :no_content
  end
end
