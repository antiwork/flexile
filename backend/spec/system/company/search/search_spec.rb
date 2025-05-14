# frozen_string_literal: true

RSpec.describe "Search" do
  include InvoiceHelpers

  let(:company) { create(:company, required_invoice_approval_count: 2) }
  let(:user) { create(:user, preferred_name: "John Parker") }
  let(:company_administrator) { create(:company_administrator, company:) }
  let(:company_worker) { create(:company_worker, user:, company:) }

  let!(:invoices) do
    [
      create(:invoice, :fully_approved, company:, user: company_worker.user),
      create(:invoice, :partially_approved, company:, user: company_worker.user),
      create(:invoice, :paid, company:, user: company_worker.user),
      create(:invoice, :rejected, company:, user: company_worker.user),
    ]
  end

  def find_search_field(**options)
    find(:combo_box, @search_placeholder, placeholder: @search_placeholder, **options)
  end

  shared_examples_for "search" do
    it "shows invoices when the first character is typed" do
      visit spa_company_invoices_path(company.external_id)

      find_search_field.set "j"
      wait_for_ajax

      within "search" do
        invoices.each do |invoice|
          expect(page).to have_text("#{invoice.invoice_number} from #{user.preferred_name}")
          expect(page).to have_text(invoice.invoice_date.to_fs(:medium))
          expect(page).to have_text(human_status(invoice))
          expect(page).to have_link(href: spa_company_invoice_path(company.external_id, invoice.external_id))
        end
      end
    end

    it "closes the search results on pressing escape" do
      visit spa_company_invoices_path(company.external_id)

      search_field = find_search_field
      search_field.set "joh"
      wait_for_ajax

      within "search" do
        expect(page).to have_selector(:combo_box_list_box, search_field)

        search_field.native.send_keys(:escape)
        expect(page).not_to have_selector(:combo_box_list_box, search_field)
      end
    end

    it "navigates on search result on pressing arrows and enter keys" do
      invoice = create(:invoice, user: company_worker.user, invoice_date: 1.year.ago, company:)
      visit spa_company_invoices_path(company.external_id)

      search_field = find_search_field
      search_field.set "joh"
      wait_for_ajax
      expect(page).to have_selector(:combo_box_list_box, search_field, visible: true)

      within "search" do
        search_field.native.send_keys(:arrow_down)
        search_field.native.send_keys(:arrow_up)

        4.times do
          search_field.native.send_keys(:arrow_down)
        end

        search_field.native.send_keys(:return)

        expect(page).to have_current_path(spa_company_invoice_path(company.external_id, invoice.external_id))
      end
    end

    it "closes search result when the keyword has no associated results" do
      visit spa_company_invoices_path(company.external_id)

      search_field = find_search_field
      search_field.set "joh"
      wait_for_ajax
      expect(page).to have_selector(:combo_box_list_box, search_field, visible: true)

      search_field.set "joh123"
      wait_for_ajax
      expect(page).not_to have_selector(:combo_box_list_box, search_field, visible: true)
    end

    it "focuses search on pressing /" do
      visit spa_company_invoices_path(company.external_id)
      find_search_field(with: "")

      find("body").native.send_keys("/")

      within "search" do
        expect(page.active_element).to eq(find_search_field)
      end
    end
  end

  context "when company administrator is signed in" do
    before do
      sign_in company_administrator.user
      @search_placeholder = "Search invoices, people..."
    end

    it "shows the correct search placeholder" do
      visit spa_company_invoices_path(company.external_id)

      find_search_field(with: "")
    end

    it "shows contractors when the first character is typed" do
      visit spa_company_invoices_path(company.external_id)

      find_search_field.set "j"
      wait_for_ajax

      within "search" do
        expect(page).to have_text(user.preferred_name)
        expect(page).to have_text(company_worker.company_role.name)
        expect(page).to have_link(href: spa_company_worker_path(company.external_id, company_worker.external_id))
      end
    end

    it "navigates to contractor using arrow keys and enter" do
      visit spa_company_invoices_path(company.external_id)

      search_field = find_search_field
      search_field.set "joh"
      wait_for_ajax
      expect(page).to have_selector(:combo_box_list_box, search_field, visible: true)

      within "search" do
        5.times do
          search_field.native.send_keys(:arrow_down)
        end

        search_field.native.send_keys(:return)
        expect(page).to have_current_path(spa_company_worker_path(company.external_id, company_worker.external_id))
      end
    end

    it_behaves_like "search"
  end

  context "when company worker is signed in" do
    before do
      sign_in company_worker.user
      @search_placeholder = "Search invoices"
    end

    it "shows the correct search placeholder" do
      visit spa_company_invoices_path(company.external_id)

      find_search_field(with: "")
    end

    it_behaves_like "search"
  end
end
