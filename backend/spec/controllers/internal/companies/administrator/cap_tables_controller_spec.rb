# frozen_string_literal: true

RSpec.describe Internal::Companies::Administrator::CapTablesController, type: :controller do
  let(:company) { create(:company, equity_enabled: true, share_price_in_usd: 10.0, fully_diluted_shares: 0) }
  let(:user) { create(:user) }
  let(:company_administrator) { create(:company_administrator, company: company, user: user) }
  let(:investors_data) do
    [
      { userId: user.external_id, shares: 100_000 }
    ]
  end

  before do
    allow(controller).to receive(:authenticate_user_json!).and_return(true)
    allow(controller).to receive(:verify_authorized).and_return(true)

    allow(controller).to receive(:current_context) do
      Current.user = user
      Current.company = company
      Current.company_administrator = company_administrator
      CurrentContext.new(user: user, company: company)
    end
  end

  describe "POST #create" do
    context "when user is company administrator" do
      before do
        company_administrator
      end

      before do
        allow(controller).to receive(:authorize).with(:cap_table).and_return(true)
      end

      context "with valid data" do
        it "creates cap table successfully" do
          post :create, params: { company_id: company.external_id, cap_table: { investors: investors_data } }

          expect(response).to have_http_status(:created)
          expect(company.share_classes.count).to eq(1)
          expect(company.company_investors.count).to eq(1)
          expect(company.share_holdings.count).to eq(1)
        end

        it "creates share class with correct name" do
          post :create, params: { company_id: company.external_id, cap_table: { investors: investors_data } }

          share_class = company.share_classes.last
          expect(share_class.name).to eq(ShareClass::DEFAULT_NAME)
        end

        it "creates company investor with correct data" do
          post :create, params: { company_id: company.external_id, cap_table: { investors: investors_data } }

          company_investor = company.company_investors.last
          expect(company_investor.user).to eq(user)
          expect(company_investor.total_shares).to eq(100_000)
        end

        it "creates share holding with correct data" do
          post :create, params: { company_id: company.external_id, cap_table: { investors: investors_data } }

          share_holding = company.share_holdings.last
          expect(share_holding.number_of_shares).to eq(100_000)
          expect(share_holding.share_price_usd).to eq(10.0)
          expect(share_holding.share_holder_name).to eq(user.legal_name)
        end
      end

      context "with invalid data" do
        context "when user is not found" do
          let(:investors_data) do
            [{ userId: "non-existent-user-id", shares: 100_000 }]
          end

          it "returns unprocessable entity status" do
            post :create, params: { company_id: company.external_id, cap_table: { investors: investors_data } }

            expect(response).to have_http_status(:unprocessable_entity)
            expect(JSON.parse(response.body)).to eq({
              "success" => false,
              "errors" => ["Investor 1: User not found"],
            })
          end
        end

        context "when company equity is not enabled" do
          let(:company) { create(:company, equity_enabled: false, share_price_in_usd: 10.0, fully_diluted_shares: 0) }

          it "returns unprocessable entity status" do
            post :create, params: { company_id: company.external_id, cap_table: { investors: investors_data } }

            expect(response).to have_http_status(:unprocessable_entity)
            expect(JSON.parse(response.body)).to eq({
              "success" => false,
              "errors" => ["Company must have equity enabled"],
            })
          end
        end

        context "when company already has cap table data" do
          before do
            create(:share_class, company: company, name: "Series A")
          end

          it "returns unprocessable entity status" do
            post :create, params: { company_id: company.external_id, cap_table: { investors: investors_data } }

            expect(response).to have_http_status(:unprocessable_entity)
            expect(JSON.parse(response.body)).to eq({
              "success" => false,
              "errors" => ["Company already has cap table data: share classes"],
            })
          end
        end

        context "when total shares exceed company limit" do
          let(:company) { create(:company, equity_enabled: true, share_price_in_usd: 10.0, fully_diluted_shares: 50_000) }
          let(:investors_data) do
            [{ userId: user.external_id, shares: 100_000 }]
          end

          it "returns unprocessable entity status" do
            post :create, params: { company_id: company.external_id, cap_table: { investors: investors_data } }

            expect(response).to have_http_status(:unprocessable_entity)
            expect(JSON.parse(response.body)).to eq({
              "success" => false,
              "errors" => ["Total shares (100000) cannot exceed company's fully diluted shares (50000)"],
            })
          end
        end
      end
    end

    context "authorization" do
      it "calls authorize with :cap_table" do
        expect(controller).to receive(:authorize).with(:cap_table).and_return(true)
        allow_any_instance_of(CreateCapTable).to receive(:perform).and_return({ success: true })

        post :create, params: { company_id: company.external_id, cap_table: { investors: investors_data } }
      end
    end

    context "when company already has existing cap table data" do
      before do
        company_administrator
        create(:company_investor, company: company, user: user)
        allow(controller).to receive(:authorize).with(:cap_table).and_return(true)
      end

      it "returns unprocessable entity status" do
        post :create, params: { company_id: company.external_id, cap_table: { investors: investors_data } }

        expect(response).to have_http_status(:unprocessable_entity)
        expect(JSON.parse(response.body)).to eq({
          "success" => false,
          "errors" => ["Company already has cap table data: investors"],
        })
      end
    end
  end
end
