# frozen_string_literal: true

class Internal::Companies::ExpenseCategoriesController < Internal::Companies::BaseController
  def index
    authorize ExpenseCategory
    expense_categories = Current.company.expense_categories
    render json: expense_categories.select(:id, :name, :expense_account_id)
  end

  def update
    authorize ExpenseCategory
    expense_category = Current.company.expense_categories.find_by(id: params[:id])
    return head :not_found unless expense_category

    expense_category.update!(expense_account_id: params[:expense_account_id])
    head :no_content
  end
end
