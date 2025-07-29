# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.0].define(version: 2025_07_29_150349) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  # Custom types defined in this database.
  # Note that some types may not work with other database engines. Be careful if changing database.
  create_enum "equity_grant_transactions_transaction_type", ["scheduled_vesting", "vesting_post_invoice_payment", "exercise", "cancellation", "manual_adjustment", "end_of_period_forfeiture"]
  create_enum "equity_grants_issue_date_relationship", ["employee", "consultant", "investor", "founder", "officer", "executive", "board_member"]
  create_enum "equity_grants_option_grant_type", ["iso", "nso"]
  create_enum "equity_grants_vesting_trigger", ["scheduled", "invoice_paid"]
  create_enum "integration_status", ["initialized", "active", "out_of_sync", "deleted"]
  create_enum "invoices_invoice_type", ["services", "other"]

  create_table "active_storage_attachments", force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.bigint "blob_id", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "balance_transactions", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.bigint "consolidated_payment_id"
    t.bigint "payment_id"
    t.bigint "amount_cents", null: false
    t.string "type", null: false
    t.string "transaction_type"
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.index ["company_id"], name: "index_balance_transactions_on_company_id"
    t.index ["consolidated_payment_id"], name: "index_balance_transactions_on_consolidated_payment_id"
    t.index ["payment_id"], name: "index_balance_transactions_on_payment_id"
  end

  create_table "balances", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.bigint "amount_cents", default: 0, null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.index ["company_id"], name: "index_balances_on_company_id"
  end

  create_table "companies", force: :cascade do |t|
    t.string "name"
    t.string "email", null: false
    t.string "registration_number"
    t.string "street_address"
    t.string "city"
    t.string "state"
    t.string "zip_code"
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.string "stripe_customer_id"
    t.integer "required_invoice_approval_count", default: 1, null: false
    t.bigint "valuation_in_dollars", default: 0, null: false
    t.bigint "fully_diluted_shares", default: 0, null: false
    t.datetime "deactivated_at"
    t.decimal "share_price_in_usd"
    t.decimal "fmv_per_share_in_usd"
    t.string "website"
    t.string "public_name"
    t.string "slug"
    t.string "tax_id"
    t.string "phone_number"
    t.string "brand_color"
    t.string "registration_state"
    t.string "external_id", null: false
    t.string "country_code"
    t.boolean "is_gumroad", default: false, null: false
    t.boolean "dividends_allowed", default: false, null: false
    t.boolean "is_trusted", default: false, null: false
    t.boolean "show_analytics_to_contractors", default: false, null: false
    t.string "default_currency", default: "usd", null: false
    t.boolean "lawyers_enabled", default: false, null: false
    t.decimal "conversion_share_price_usd"
    t.jsonb "json_data", default: {"flags" => []}, null: false
    t.boolean "equity_enabled", default: false, null: false
    t.index ["external_id"], name: "index_companies_on_external_id", unique: true
  end

  create_table "company_administrators", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "company_id", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.string "external_id", null: false
    t.index ["company_id"], name: "index_company_administrators_on_company_id"
    t.index ["external_id"], name: "index_company_administrators_on_external_id", unique: true
    t.index ["user_id", "company_id"], name: "index_company_administrators_on_user_id_and_company_id", unique: true
    t.index ["user_id"], name: "index_company_administrators_on_user_id"
  end

  create_table "company_contractors", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "company_id", null: false
    t.datetime "started_at", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.datetime "ended_at"
    t.string "external_id", null: false
    t.integer "pay_rate_type", default: 0, null: false
    t.boolean "sent_equity_percent_selection_email", default: false, null: false
    t.integer "pay_rate_in_subunits"
    t.string "pay_rate_currency", default: "usd", null: false
    t.string "role"
    t.boolean "contract_signed_elsewhere", default: false, null: false
    t.integer "equity_percentage", default: 0, null: false
    t.index ["company_id"], name: "index_company_contractors_on_company_id"
    t.index ["external_id"], name: "index_company_contractors_on_external_id", unique: true
    t.index ["user_id", "company_id"], name: "index_company_contractors_on_user_id_and_company_id", unique: true
    t.index ["user_id"], name: "index_company_contractors_on_user_id"
  end

  create_table "company_investor_entities", force: :cascade do |t|
    t.string "external_id", null: false
    t.bigint "company_id", null: false
    t.string "name", null: false
    t.bigint "investment_amount_cents", null: false
    t.string "cap_table_notes"
    t.bigint "total_shares", default: 0, null: false
    t.bigint "total_options", default: 0, null: false
    t.virtual "fully_diluted_shares", type: :bigint, as: "(total_shares + total_options)", stored: true
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.string "email", null: false
    t.index ["company_id", "email", "name"], name: "idx_on_company_id_email_name_6c6bac5ed9", unique: true
    t.index ["company_id"], name: "index_company_investor_entities_on_company_id"
    t.index ["external_id"], name: "index_company_investor_entities_on_external_id", unique: true
  end

  create_table "company_investors", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "company_id", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.bigint "total_shares", default: 0, null: false
    t.bigint "investment_amount_in_cents", null: false
    t.string "cap_table_notes"
    t.string "external_id", null: false
    t.bigint "total_options", default: 0, null: false
    t.virtual "fully_diluted_shares", type: :bigint, as: "(total_shares + total_options)", stored: true
    t.boolean "invested_in_angel_list_ruv", default: false, null: false
    t.index ["company_id"], name: "index_company_investors_on_company_id"
    t.index ["external_id"], name: "index_company_investors_on_external_id", unique: true
    t.index ["user_id", "company_id"], name: "index_company_investors_on_user_id_and_company_id", unique: true
    t.index ["user_id"], name: "index_company_investors_on_user_id"
  end

  create_table "company_invite_links", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.bigint "document_template_id"
    t.string "token", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["company_id", "document_template_id"], name: "idx_on_company_id_document_template_id_57bbad7c26", unique: true
    t.index ["company_id"], name: "index_company_invite_links_on_company_id"
    t.index ["document_template_id"], name: "index_company_invite_links_on_document_template_id"
    t.index ["token"], name: "index_company_invite_links_on_token", unique: true
  end

  create_table "company_lawyers", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "company_id", null: false
    t.string "external_id", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.index ["company_id"], name: "index_company_lawyers_on_company_id"
    t.index ["external_id"], name: "index_company_lawyers_on_external_id", unique: true
    t.index ["user_id", "company_id"], name: "index_company_lawyers_on_user_id_and_company_id", unique: true
    t.index ["user_id"], name: "index_company_lawyers_on_user_id"
  end

  create_table "company_monthly_financial_reports", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.integer "year", null: false
    t.integer "month", null: false
    t.bigint "net_income_cents", null: false
    t.bigint "revenue_cents", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.index ["company_id", "year", "month"], name: "index_company_monthly_financials_on_company_year_month", unique: true
    t.index ["company_id"], name: "index_company_monthly_financial_reports_on_company_id"
  end

  create_table "company_stripe_accounts", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.string "status", default: "initial", null: false
    t.string "setup_intent_id", null: false
    t.string "bank_account_last_four"
    t.datetime "deleted_at"
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.index ["company_id"], name: "index_company_stripe_accounts_on_company_id"
  end

  create_table "company_updates", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.string "title", null: false
    t.text "body", null: false
    t.text "video_url"
    t.datetime "sent_at"
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.string "external_id", null: false
    t.string "period"
    t.date "period_started_on"
    t.boolean "show_revenue", default: false, null: false
    t.boolean "show_net_income", default: false, null: false
    t.index ["company_id"], name: "index_company_updates_on_company_id"
    t.index ["external_id"], name: "index_company_updates_on_external_id", unique: true
  end

  create_table "company_updates_financial_reports", force: :cascade do |t|
    t.bigint "company_update_id", null: false
    t.bigint "company_monthly_financial_report_id", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.index ["company_monthly_financial_report_id"], name: "idx_on_company_monthly_financial_report_id_d65ba22efd"
    t.index ["company_update_id"], name: "index_company_updates_financial_reports_on_company_update_id"
  end

  create_table "consolidated_invoices", force: :cascade do |t|
    t.date "period_start_date", null: false
    t.date "period_end_date", null: false
    t.date "invoice_date", null: false
    t.bigint "company_id", null: false
    t.bigint "total_cents", null: false
    t.bigint "flexile_fee_cents", null: false
    t.bigint "transfer_fee_cents", null: false
    t.bigint "invoice_amount_cents", null: false
    t.datetime "paid_at"
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.string "status", null: false
    t.string "invoice_number", null: false
    t.index ["company_id"], name: "index_consolidated_invoices_on_company_id"
  end

  create_table "consolidated_invoices_invoices", force: :cascade do |t|
    t.bigint "consolidated_invoice_id", null: false
    t.bigint "invoice_id", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.index ["consolidated_invoice_id"], name: "index_consolidated_invoices_invoices_on_consolidated_invoice_id"
    t.index ["invoice_id"], name: "index_consolidated_invoices_invoices_on_invoice_id"
  end

  create_table "consolidated_payments", force: :cascade do |t|
    t.bigint "consolidated_invoice_id", null: false
    t.bigint "stripe_fee_cents"
    t.string "stripe_payment_intent_id"
    t.string "stripe_transaction_id"
    t.datetime "succeeded_at"
    t.string "stripe_payout_id"
    t.datetime "trigger_payout_after"
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.string "status", default: "initial", null: false
    t.string "bank_account_last_four"
    t.index ["consolidated_invoice_id"], name: "index_consolidated_payments_on_consolidated_invoice_id"
  end

  create_table "convertible_investments", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.bigint "company_valuation_in_dollars", null: false
    t.bigint "amount_in_cents", null: false
    t.bigint "implied_shares", null: false
    t.string "valuation_type", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.string "identifier", null: false
    t.string "entity_name", null: false
    t.datetime "issued_at", null: false
    t.string "convertible_type", null: false
    t.index ["company_id"], name: "index_convertible_investments_on_company_id"
  end

  create_table "convertible_securities", force: :cascade do |t|
    t.bigint "company_investor_id", null: false
    t.bigint "principal_value_in_cents", null: false
    t.datetime "issued_at", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.bigint "convertible_investment_id", null: false
    t.decimal "implied_shares", null: false
    t.index ["company_investor_id"], name: "index_convertible_securities_on_company_investor_id"
    t.index ["convertible_investment_id"], name: "index_convertible_securities_on_convertible_investment_id"
  end

  create_table "dividend_computation_outputs", force: :cascade do |t|
    t.bigint "dividend_computation_id", null: false
    t.string "share_class", null: false
    t.bigint "number_of_shares", null: false
    t.decimal "hurdle_rate"
    t.decimal "original_issue_price_in_usd"
    t.decimal "preferred_dividend_amount_in_usd", null: false
    t.decimal "dividend_amount_in_usd", null: false
    t.decimal "total_amount_in_usd", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.string "investor_name"
    t.bigint "company_investor_id"
    t.decimal "qualified_dividend_amount_usd", null: false
    t.index ["company_investor_id"], name: "index_dividend_computation_outputs_on_company_investor_id"
    t.index ["dividend_computation_id"], name: "index_dividend_computation_outputs_on_dividend_computation_id"
  end

  create_table "dividend_computations", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.decimal "total_amount_in_usd", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.date "dividends_issuance_date", null: false
    t.string "external_id", null: false
    t.boolean "return_of_capital", null: false
    t.index ["company_id"], name: "index_dividend_computations_on_company_id"
    t.index ["external_id"], name: "index_dividend_computations_on_external_id", unique: true
  end

  create_table "dividend_payments", force: :cascade do |t|
    t.string "status", null: false
    t.string "processor_uuid"
    t.string "wise_quote_id"
    t.string "transfer_id"
    t.string "transfer_status"
    t.decimal "transfer_amount"
    t.string "transfer_currency"
    t.datetime "wise_transfer_estimate"
    t.string "recipient_last4"
    t.decimal "conversion_rate"
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.bigint "total_transaction_cents"
    t.bigint "wise_credential_id"
    t.bigint "transfer_fee_in_cents"
    t.string "processor_name", null: false
    t.bigint "wise_recipient_id"
    t.index ["wise_recipient_id"], name: "index_dividend_payments_on_wise_recipient_id"
  end

  create_table "dividend_rounds", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.datetime "issued_at", null: false
    t.bigint "number_of_shares", null: false
    t.bigint "number_of_shareholders", null: false
    t.bigint "total_amount_in_cents", null: false
    t.string "status", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.string "external_id", null: false
    t.boolean "return_of_capital", null: false
    t.boolean "ready_for_payment", default: false, null: false
    t.text "release_document"
    t.index ["company_id"], name: "index_dividend_rounds_on_company_id"
    t.index ["external_id"], name: "index_dividend_rounds_on_external_id", unique: true
  end

  create_table "dividends", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.bigint "dividend_round_id", null: false
    t.bigint "company_investor_id", null: false
    t.bigint "total_amount_in_cents", null: false
    t.bigint "number_of_shares"
    t.datetime "paid_at"
    t.string "status", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.string "retained_reason"
    t.bigint "withheld_tax_cents"
    t.bigint "net_amount_in_cents"
    t.integer "withholding_percentage"
    t.bigint "user_compliance_info_id"
    t.bigint "qualified_amount_cents", null: false
    t.datetime "signed_release_at"
    t.index ["company_id"], name: "index_dividends_on_company_id"
    t.index ["company_investor_id"], name: "index_dividends_on_company_investor_id"
    t.index ["dividend_round_id"], name: "index_dividends_on_dividend_round_id"
    t.index ["user_compliance_info_id"], name: "index_dividends_on_user_compliance_info_id"
  end

  create_table "dividends_dividend_payments", id: false, force: :cascade do |t|
    t.bigint "dividend_id", null: false
    t.bigint "dividend_payment_id", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.index ["dividend_id"], name: "index_dividends_dividend_payments_on_dividend_id"
    t.index ["dividend_payment_id"], name: "index_dividends_dividend_payments_on_dividend_payment_id"
  end

  create_table "document_signatures", force: :cascade do |t|
    t.bigint "document_id", null: false
    t.bigint "user_id", null: false
    t.string "title", null: false
    t.datetime "signed_at"
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.index ["document_id"], name: "index_document_signatures_on_document_id"
    t.index ["user_id"], name: "index_document_signatures_on_user_id"
  end

  create_table "document_templates", force: :cascade do |t|
    t.bigint "company_id"
    t.string "name", null: false
    t.integer "document_type", null: false
    t.string "external_id", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.boolean "signable", default: false, null: false
    t.bigint "docuseal_id", null: false
    t.index ["company_id"], name: "index_document_templates_on_company_id"
    t.index ["external_id"], name: "index_document_templates_on_external_id", unique: true
  end

  create_table "documents", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.bigint "user_compliance_info_id"
    t.bigint "equity_grant_id"
    t.string "name", null: false
    t.integer "document_type", null: false
    t.integer "year", null: false
    t.datetime "deleted_at"
    t.datetime "emailed_at"
    t.jsonb "json_data"
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.integer "docuseal_submission_id"
    t.index ["company_id"], name: "index_documents_on_company_id"
    t.index ["docuseal_submission_id"], name: "index_documents_on_docuseal_submission_id"
    t.index ["equity_grant_id"], name: "index_documents_on_equity_grant_id"
    t.index ["user_compliance_info_id"], name: "index_documents_on_user_compliance_info_id"
  end

  create_table "equity_buyback_payments", force: :cascade do |t|
    t.string "status", null: false
    t.string "processor_uuid"
    t.string "wise_quote_id"
    t.string "transfer_id"
    t.string "transfer_status"
    t.decimal "transfer_amount"
    t.string "transfer_currency"
    t.datetime "wise_transfer_estimate"
    t.string "recipient_last4"
    t.decimal "conversion_rate"
    t.bigint "total_transaction_cents"
    t.bigint "wise_credential_id"
    t.bigint "transfer_fee_cents"
    t.string "processor_name", null: false
    t.bigint "wise_recipient_id"
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
  end

  create_table "equity_buyback_rounds", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.bigint "tender_offer_id", null: false
    t.bigint "number_of_shares", null: false
    t.bigint "number_of_shareholders", null: false
    t.bigint "total_amount_cents", null: false
    t.string "status", null: false
    t.datetime "issued_at", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.boolean "ready_for_payment", default: false, null: false
    t.index ["company_id"], name: "index_equity_buyback_rounds_on_company_id"
    t.index ["tender_offer_id"], name: "index_equity_buyback_rounds_on_tender_offer_id"
  end

  create_table "equity_buybacks", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.bigint "company_investor_id", null: false
    t.bigint "equity_buyback_round_id", null: false
    t.bigint "total_amount_cents", null: false
    t.bigint "share_price_cents", null: false
    t.bigint "exercise_price_cents", null: false
    t.bigint "number_of_shares"
    t.datetime "paid_at"
    t.string "status", null: false
    t.string "retained_reason"
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.string "security_type", null: false
    t.bigint "security_id", null: false
    t.string "share_class", null: false
    t.index ["company_id"], name: "index_equity_buybacks_on_company_id"
    t.index ["company_investor_id"], name: "index_equity_buybacks_on_company_investor_id"
    t.index ["equity_buyback_round_id"], name: "index_equity_buybacks_on_equity_buyback_round_id"
    t.index ["security_type", "security_id"], name: "index_equity_buybacks_on_security"
  end

  create_table "equity_buybacks_equity_buyback_payments", force: :cascade do |t|
    t.bigint "equity_buyback_id", null: false
    t.bigint "equity_buyback_payment_id", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.index ["equity_buyback_id"], name: "idx_on_equity_buyback_id_fa143c8057"
    t.index ["equity_buyback_payment_id"], name: "idx_on_equity_buyback_payment_id_146a2cc767"
  end

  create_table "equity_exercise_bank_accounts", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.jsonb "details", null: false
    t.string "account_number", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.index ["company_id"], name: "index_equity_exercise_bank_accounts_on_company_id"
  end

  create_table "equity_grant_exercise_requests", force: :cascade do |t|
    t.bigint "equity_grant_id", null: false
    t.bigint "equity_grant_exercise_id", null: false
    t.integer "number_of_options", null: false
    t.decimal "exercise_price_usd", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.bigint "share_holding_id"
    t.index ["equity_grant_exercise_id"], name: "idx_on_equity_grant_exercise_id_7be508b15c"
    t.index ["equity_grant_id"], name: "index_equity_grant_exercise_requests_on_equity_grant_id"
    t.index ["share_holding_id"], name: "index_equity_grant_exercise_requests_on_share_holding_id"
  end

  create_table "equity_grant_exercises", force: :cascade do |t|
    t.bigint "company_investor_id", null: false
    t.datetime "requested_at", null: false
    t.datetime "signed_at"
    t.bigint "number_of_options", null: false
    t.bigint "total_cost_cents", null: false
    t.string "status", null: false
    t.string "bank_reference", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.bigint "company_id", null: false
    t.bigint "equity_exercise_bank_account_id"
    t.index ["company_id"], name: "index_equity_grant_exercises_on_company_id"
    t.index ["company_investor_id"], name: "index_equity_grant_exercises_on_company_investor_id"
    t.index ["equity_exercise_bank_account_id"], name: "idx_on_equity_exercise_bank_account_id_92fefd4aa1"
  end

  create_table "equity_grant_transactions", force: :cascade do |t|
    t.string "external_id", null: false
    t.bigint "equity_grant_id", null: false
    t.enum "transaction_type", null: false, enum_type: "equity_grant_transactions_transaction_type"
    t.bigint "vesting_event_id"
    t.bigint "invoice_id"
    t.bigint "equity_grant_exercise_id"
    t.jsonb "metadata", default: {}, null: false
    t.text "notes"
    t.bigint "vested_shares", default: 0, null: false
    t.bigint "exercised_shares", default: 0, null: false
    t.bigint "forfeited_shares", default: 0, null: false
    t.bigint "total_number_of_shares", null: false
    t.bigint "total_vested_shares", null: false
    t.bigint "total_unvested_shares", null: false
    t.bigint "total_exercised_shares", null: false
    t.bigint "total_forfeited_shares", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.index ["equity_grant_exercise_id"], name: "index_equity_grant_transactions_on_equity_grant_exercise_id"
    t.index ["equity_grant_id", "transaction_type", "vesting_event_id", "invoice_id", "equity_grant_exercise_id"], name: "idx_equity_grant_transactions_on_all_columns", unique: true
    t.index ["equity_grant_id"], name: "index_equity_grant_transactions_on_equity_grant_id"
    t.index ["external_id"], name: "index_equity_grant_transactions_on_external_id", unique: true
    t.index ["invoice_id"], name: "index_equity_grant_transactions_on_invoice_id"
    t.index ["vesting_event_id"], name: "index_equity_grant_transactions_on_vesting_event_id"
  end

  create_table "equity_grants", force: :cascade do |t|
    t.string "name", null: false
    t.datetime "period_started_at", null: false
    t.datetime "period_ended_at", null: false
    t.integer "number_of_shares", null: false
    t.datetime "exercised_at"
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.bigint "company_investor_id", null: false
    t.bigint "option_pool_id", null: false
    t.integer "vested_shares", null: false
    t.integer "exercised_shares", null: false
    t.integer "forfeited_shares", null: false
    t.integer "unvested_shares", null: false
    t.datetime "issued_at", null: false
    t.string "option_holder_name", null: false
    t.datetime "expires_at", null: false
    t.bigint "active_exercise_id"
    t.decimal "share_price_usd", null: false
    t.virtual "vested_amount_usd", type: :decimal, as: "((vested_shares)::numeric * share_price_usd)", stored: true
    t.decimal "exercise_price_usd", null: false
    t.enum "issue_date_relationship", default: "consultant", null: false, enum_type: "equity_grants_issue_date_relationship"
    t.date "board_approval_date"
    t.enum "option_grant_type", default: "nso", null: false, enum_type: "equity_grants_option_grant_type"
    t.integer "voluntary_termination_exercise_months", null: false
    t.integer "involuntary_termination_exercise_months", null: false
    t.integer "termination_with_cause_exercise_months", null: false
    t.integer "death_exercise_months", null: false
    t.integer "disability_exercise_months", null: false
    t.integer "retirement_exercise_months", null: false
    t.datetime "accepted_at"
    t.bigint "company_investor_entity_id"
    t.string "external_id", null: false
    t.bigint "vesting_schedule_id"
    t.enum "vesting_trigger", null: false, enum_type: "equity_grants_vesting_trigger"
    t.datetime "cancelled_at"
    t.index ["company_investor_entity_id"], name: "index_equity_grants_on_company_investor_entity_id"
    t.index ["company_investor_id"], name: "index_equity_grants_on_company_investor_id"
    t.index ["external_id"], name: "index_equity_grants_on_external_id", unique: true
    t.index ["option_pool_id"], name: "index_equity_grants_on_option_pool_id"
    t.index ["vesting_schedule_id"], name: "index_equity_grants_on_vesting_schedule_id"
  end

  create_table "expense_categories", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.string "name", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.string "expense_account_id"
    t.index ["company_id"], name: "index_expense_categories_on_company_id"
  end

  create_table "integration_records", force: :cascade do |t|
    t.bigint "integration_id", null: false
    t.string "integratable_type"
    t.bigint "integratable_id"
    t.string "integration_external_id", null: false
    t.string "sync_token"
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.datetime "deleted_at"
    t.jsonb "json_data"
    t.boolean "quickbooks_journal_entry", default: false, null: false
    t.index ["integratable_type", "integratable_id"], name: "index_integration_records_on_integratable"
    t.index ["integration_id"], name: "index_integration_records_on_integration_id"
  end

  create_table "integrations", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.string "type", null: false
    t.enum "status", default: "initialized", null: false, enum_type: "integration_status"
    t.jsonb "configuration"
    t.text "sync_error"
    t.datetime "last_sync_at"
    t.datetime "deleted_at"
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.string "account_id", null: false
    t.index ["company_id", "type"], name: "unique_active_integration_types", unique: true, where: "(deleted_at IS NULL)"
    t.index ["company_id"], name: "index_integrations_on_company_id"
  end

  create_table "investor_dividend_rounds", force: :cascade do |t|
    t.bigint "company_investor_id", null: false
    t.bigint "dividend_round_id", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.boolean "sanctioned_country_email_sent", default: false, null: false
    t.boolean "payout_below_threshold_email_sent", default: false, null: false
    t.boolean "dividend_issued_email_sent", default: false, null: false
    t.index ["company_investor_id", "dividend_round_id"], name: "index_investor_dividend_round_uniqueness", unique: true
    t.index ["company_investor_id"], name: "index_investor_dividend_rounds_on_company_investor_id"
    t.index ["dividend_round_id"], name: "index_investor_dividend_rounds_on_dividend_round_id"
  end

  create_table "invoice_approvals", force: :cascade do |t|
    t.bigint "invoice_id", null: false
    t.bigint "approver_id", null: false
    t.datetime "approved_at", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.index ["approver_id"], name: "index_invoice_approvals_on_approver_id"
    t.index ["invoice_id", "approver_id"], name: "index_approvals_on_invoice_and_approver", unique: true
    t.index ["invoice_id"], name: "index_invoice_approvals_on_invoice_id"
  end

  create_table "invoice_expenses", force: :cascade do |t|
    t.bigint "invoice_id", null: false
    t.bigint "expense_category_id", null: false
    t.bigint "total_amount_in_cents", null: false
    t.string "description", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.index ["expense_category_id"], name: "index_invoice_expenses_on_expense_category_id"
    t.index ["invoice_id"], name: "index_invoice_expenses_on_invoice_id"
  end

  create_table "invoice_line_items", force: :cascade do |t|
    t.bigint "invoice_id", null: false
    t.string "description", null: false
    t.decimal "quantity", precision: 10, scale: 2, null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.integer "pay_rate_in_subunits", null: false
    t.string "pay_rate_currency", default: "usd", null: false
    t.boolean "hourly", default: false, null: false
    t.index ["invoice_id"], name: "index_invoice_line_items_on_invoice_id"
  end

  create_table "invoices", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "company_id", null: false
    t.date "invoice_date", null: false
    t.bigint "total_amount_in_usd_cents", null: false
    t.string "status", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.string "invoice_number", null: false
    t.string "description"
    t.datetime "paid_at"
    t.date "due_on", null: false
    t.string "bill_from", null: false
    t.string "bill_to", null: false
    t.text "notes"
    t.integer "invoice_approvals_count", default: 0, null: false
    t.integer "equity_percentage", null: false
    t.bigint "equity_amount_in_cents", null: false
    t.integer "equity_amount_in_options", null: false
    t.bigint "cash_amount_in_cents", null: false
    t.bigint "flags", default: 0, null: false
    t.bigint "company_contractor_id", null: false
    t.bigint "equity_grant_id"
    t.bigint "rejected_by_id"
    t.string "rejection_reason"
    t.datetime "rejected_at"
    t.string "external_id", null: false
    t.string "street_address"
    t.string "city"
    t.string "state"
    t.string "zip_code"
    t.bigint "flexile_fee_cents"
    t.string "country_code"
    t.bigint "created_by_id", null: false
    t.enum "invoice_type", default: "services", null: false, enum_type: "invoices_invoice_type"
    t.integer "min_allowed_equity_percentage"
    t.integer "max_allowed_equity_percentage"
    t.datetime "accepted_at"
    t.datetime "deleted_at"
    t.index ["company_contractor_id"], name: "index_invoices_on_company_contractor_id"
    t.index ["company_id", "invoice_date", "created_at"], name: "idx_invoices_company_alive_date_created", order: { invoice_date: :desc, created_at: :desc }, where: "(deleted_at IS NULL)"
    t.index ["company_id"], name: "index_invoices_on_company_id"
    t.index ["created_by_id"], name: "index_invoices_on_created_by_id"
    t.index ["equity_grant_id"], name: "index_invoices_on_equity_grant_id"
    t.index ["external_id"], name: "index_invoices_on_external_id", unique: true
    t.index ["rejected_by_id"], name: "index_invoices_on_rejected_by_id"
    t.index ["user_id"], name: "index_invoices_on_user_id"
  end

  create_table "option_pools", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.string "name", null: false
    t.bigint "authorized_shares", null: false
    t.bigint "issued_shares", null: false
    t.virtual "available_shares", type: :bigint, as: "(authorized_shares - issued_shares)", stored: true
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.bigint "share_class_id", null: false
    t.integer "default_option_expiry_months", default: 120, null: false
    t.integer "voluntary_termination_exercise_months", default: 120, null: false
    t.integer "involuntary_termination_exercise_months", default: 120, null: false
    t.integer "termination_with_cause_exercise_months", default: 0, null: false
    t.integer "death_exercise_months", default: 120, null: false
    t.integer "disability_exercise_months", default: 120, null: false
    t.integer "retirement_exercise_months", default: 120, null: false
    t.string "external_id", null: false
    t.index ["company_id"], name: "index_option_pools_on_company_id"
    t.index ["external_id"], name: "index_option_pools_on_external_id", unique: true
    t.index ["share_class_id"], name: "index_option_pools_on_share_class_id"
  end

  create_table "payments", force: :cascade do |t|
    t.bigint "invoice_id", null: false
    t.string "status", default: "initial", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.string "processor_uuid"
    t.string "wise_quote_id"
    t.string "wise_transfer_id"
    t.string "wise_transfer_status"
    t.decimal "wise_transfer_amount"
    t.string "wise_transfer_currency"
    t.datetime "wise_transfer_estimate"
    t.string "recipient_last4"
    t.decimal "conversion_rate"
    t.bigint "wise_credential_id"
    t.bigint "net_amount_in_cents", null: false
    t.bigint "transfer_fee_in_cents"
    t.bigint "wise_recipient_id"
    t.index ["invoice_id"], name: "index_payments_on_invoice_id"
    t.index ["wise_credential_id"], name: "index_payments_on_wise_credential_id"
    t.index ["wise_recipient_id"], name: "index_payments_on_wise_recipient_id"
  end

  create_table "pg_search_documents", force: :cascade do |t|
    t.text "content"
    t.bigint "company_id"
    t.string "searchable_type"
    t.bigint "searchable_id"
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.index ["company_id"], name: "index_pg_search_documents_on_company_id"
    t.index ["searchable_type", "searchable_id"], name: "index_pg_search_documents_on_searchable"
  end

  create_table "share_classes", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.string "name", null: false
    t.decimal "original_issue_price_in_dollars"
    t.decimal "hurdle_rate"
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.boolean "preferred", default: false, null: false
    t.index ["company_id"], name: "index_share_classes_on_company_id"
  end

  create_table "share_holdings", force: :cascade do |t|
    t.bigint "company_investor_id", null: false
    t.bigint "equity_grant_id"
    t.string "name", null: false
    t.datetime "issued_at", null: false
    t.integer "number_of_shares", null: false
    t.bigint "total_amount_in_cents", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.bigint "share_class_id", null: false
    t.string "share_holder_name", null: false
    t.decimal "share_price_usd", null: false
    t.datetime "originally_acquired_at", null: false
    t.bigint "company_investor_entity_id"
    t.index ["company_investor_entity_id"], name: "index_share_holdings_on_company_investor_entity_id"
    t.index ["company_investor_id"], name: "index_share_holdings_on_company_investor_id"
    t.index ["equity_grant_id"], name: "index_share_holdings_on_equity_grant_id"
    t.index ["share_class_id"], name: "index_share_holdings_on_share_class_id"
  end

  create_table "tender_offer_bids", force: :cascade do |t|
    t.string "external_id", null: false
    t.bigint "tender_offer_id", null: false
    t.bigint "company_investor_id", null: false
    t.decimal "number_of_shares", null: false
    t.integer "share_price_cents", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.string "share_class", null: false
    t.decimal "accepted_shares", default: "0.0", null: false
    t.index ["company_investor_id"], name: "index_tender_offer_bids_on_company_investor_id"
    t.index ["external_id"], name: "index_tender_offer_bids_on_external_id", unique: true
    t.index ["tender_offer_id"], name: "index_tender_offer_bids_on_tender_offer_id"
  end

  create_table "tender_offers", force: :cascade do |t|
    t.bigint "company_id", null: false
    t.string "external_id", null: false
    t.datetime "starts_at", null: false
    t.datetime "ends_at", null: false
    t.bigint "minimum_valuation", null: false
    t.bigint "number_of_shares"
    t.integer "number_of_shareholders"
    t.bigint "total_amount_in_cents"
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.integer "accepted_price_cents"
    t.index ["company_id"], name: "index_tender_offers_on_company_id"
    t.index ["external_id"], name: "index_tender_offers_on_external_id", unique: true
  end

  create_table "tos_agreements", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "ip_address", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_tos_agreements_on_user_id"
  end

  create_table "user_compliance_infos", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "legal_name"
    t.date "birth_date"
    t.string "tax_id"
    t.string "street_address"
    t.string "city"
    t.string "state"
    t.string "zip_code"
    t.string "signature"
    t.string "business_name"
    t.datetime "tax_information_confirmed_at"
    t.datetime "deleted_at"
    t.integer "flags", default: 0, null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.string "tax_id_status"
    t.string "country_code"
    t.string "citizenship_country_code"
    t.boolean "business_entity", default: false
    t.integer "business_type"
    t.integer "tax_classification"
    t.index ["user_id"], name: "index_user_compliance_infos_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.string "reset_password_token"
    t.datetime "reset_password_sent_at"
    t.datetime "remember_created_at"
    t.integer "sign_in_count", default: 0, null: false
    t.datetime "current_sign_in_at"
    t.datetime "last_sign_in_at"
    t.string "current_sign_in_ip"
    t.string "last_sign_in_ip"
    t.string "confirmation_token"
    t.datetime "confirmed_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "confirmation_sent_at"
    t.string "unconfirmed_email"
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.string "invitation_token"
    t.datetime "invitation_created_at"
    t.datetime "invitation_sent_at"
    t.datetime "invitation_accepted_at"
    t.integer "invitation_limit"
    t.string "invited_by_type"
    t.bigint "invited_by_id"
    t.integer "invitations_count", default: 0
    t.date "birth_date"
    t.string "street_address"
    t.string "city"
    t.string "zip_code"
    t.string "state"
    t.string "legal_name"
    t.string "preferred_name"
    t.string "gumroad_user_id"
    t.bigint "minimum_dividend_payment_in_cents", default: 1000, null: false
    t.string "external_id", null: false
    t.string "country_code"
    t.string "citizenship_country_code"
    t.boolean "signed_documents", default: false, null: false
    t.boolean "team_member", default: false, null: false
    t.boolean "sent_invalid_tax_id_email", default: false, null: false
    t.string "clerk_id"
    t.bigint "signup_invite_link_id"
    t.index ["clerk_id"], name: "index_users_on_clerk_id", unique: true
    t.index ["confirmation_token"], name: "index_users_on_confirmation_token", unique: true
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["external_id"], name: "index_users_on_external_id", unique: true
    t.index ["invitation_token"], name: "index_users_on_invitation_token", unique: true
    t.index ["invited_by_id"], name: "index_users_on_invited_by_id"
    t.index ["invited_by_type", "invited_by_id"], name: "index_users_on_invited_by"
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
    t.index ["signup_invite_link_id"], name: "index_users_on_signup_invite_link_id"
  end

  create_table "versions", force: :cascade do |t|
    t.string "item_type", null: false
    t.bigint "item_id", null: false
    t.string "event", null: false
    t.string "whodunnit"
    t.datetime "created_at"
    t.string "remote_ip"
    t.text "request_path"
    t.string "request_uuid"
    t.json "object"
    t.json "object_changes"
    t.index ["item_type", "item_id"], name: "index_versions_on_item_type_and_item_id"
  end

  create_table "vesting_events", force: :cascade do |t|
    t.string "external_id", null: false
    t.bigint "equity_grant_id", null: false
    t.datetime "vesting_date", null: false
    t.bigint "vested_shares", null: false
    t.datetime "processed_at"
    t.datetime "cancelled_at"
    t.string "cancellation_reason"
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.index ["equity_grant_id"], name: "index_vesting_events_on_equity_grant_id"
    t.index ["external_id"], name: "index_vesting_events_on_external_id", unique: true
  end

  create_table "vesting_schedules", force: :cascade do |t|
    t.string "external_id", null: false
    t.integer "total_vesting_duration_months", null: false
    t.integer "cliff_duration_months", null: false
    t.integer "vesting_frequency_months", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.index ["external_id"], name: "index_vesting_schedules_on_external_id", unique: true
    t.index ["total_vesting_duration_months", "cliff_duration_months", "vesting_frequency_months"], name: "idx_vesting_schedule_option", unique: true
  end

  create_table "wise_credentials", force: :cascade do |t|
    t.string "profile_id", null: false
    t.string "api_key", null: false
    t.datetime "deleted_at"
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
  end

  create_table "wise_recipients", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "recipient_id", null: false
    t.string "bank_name"
    t.string "last_four_digits"
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.datetime "updated_at", null: false
    t.string "currency"
    t.string "country_code", null: false
    t.datetime "deleted_at"
    t.bigint "wise_credential_id"
    t.boolean "used_for_invoices", default: false, null: false
    t.boolean "used_for_dividends", default: false, null: false
    t.string "account_holder_name"
    t.index ["user_id", "used_for_dividends"], name: "index_wise_recipients_on_user_id_and_used_for_dividends", unique: true, where: "((user_id IS NOT NULL) AND (deleted_at IS NULL) AND (used_for_dividends IS TRUE))"
    t.index ["user_id", "used_for_invoices"], name: "index_wise_recipients_on_user_id_and_used_for_invoices", unique: true, where: "((user_id IS NOT NULL) AND (deleted_at IS NULL) AND (used_for_invoices IS TRUE))"
    t.index ["user_id"], name: "index_wise_recipients_on_user_id"
    t.index ["wise_credential_id"], name: "index_wise_recipients_on_wise_credential_id"
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
end
