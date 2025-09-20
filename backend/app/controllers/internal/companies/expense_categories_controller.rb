# frozen_string_literal: true

class Internal::Companies::ExpenseCategoriesController < Internal::Companies::BaseController
  def index
    authorize ExpenseCategory
    expense_categories = Current.company.expense_categories
    render json: expense_categories.select(:id, :name, :expense_account_id)
  end
end
