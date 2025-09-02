# frozen_string_literal: true

RSpec.describe CompanyUsersPresenter do
  let(:company) { create(:company) }
  let(:user1) { create(:user, legal_name: "User One", preferred_name: "User1") }
  let(:user2) { create(:user, legal_name: "User Two", preferred_name: "User2") }
  let(:user3) { create(:user, legal_name: "User Three", preferred_name: "User3") }
  let(:user4) { create(:user, legal_name: "User Four", preferred_name: "User4") }

  let(:presenter) { described_class.new(company: company) }

  describe "#users" do
    context "when no filters are provided (default behavior)" do
      it "returns all users from all roles" do
        create(:company_administrator, company: company, user: user1)
        create(:company_lawyer, company: company, user: user2)
        create(:company_worker, company: company, user: user3)
        create(:company_investor, company: company, user: user4)

        result = presenter.users

        expect(result.length).to eq(4)
        user_ids = result.map { |u| u[:id] }
        expect(user_ids).to include(user1.external_id, user2.external_id, user3.external_id, user4.external_id)
      end

      it "returns users with correct structure" do
        create(:company_administrator, company: company, user: user1)

        result = presenter.users

        expect(result.first).to include(
          :id,
          :email,
          :name,
          :allRoles,
          :isOwner,
          :isAdmin
        )
        expect(result.first[:id]).to eq(user1.external_id)
        expect(result.first[:name]).to eq(user1.legal_name)
        expect(result.first[:allRoles]).to include("Admin")
        expect(result.first[:isAdmin]).to be(true)
      end

      it "removes duplicate users across roles" do
        create(:company_administrator, company: company, user: user1)
        create(:company_lawyer, company: company, user: user1)
        create(:company_investor, company: company, user: user2)

        result = presenter.users

        expect(result.length).to eq(2)
        expect(result.map { |u| u[:id] }).to contain_exactly(user1.external_id, user2.external_id)

        user1_result = result.find { |u| u[:id] == user1.external_id }
        expect(user1_result[:allRoles]).to contain_exactly("Admin", "Lawyer")
      end
    end

    context "when filtering by administrators" do
      it "returns only administrators" do
        create(:company_administrator, company: company, user: user1)
        create(:company_lawyer, company: company, user: user2)

        result = presenter.users("administrators")

        expect(result.length).to eq(1)
        expect(result.first[:id]).to eq(user1.external_id)
        expect(result.first[:role]).to eq("Owner")
      end

      it "handles primary admin correctly" do
        create(:company_administrator, company: company, user: user1)
        create(:company_administrator, company: company, user: user2)

        result = presenter.users("administrators")

        expect(result.length).to eq(2)
        result_by_id = result.index_by { |u| u[:id] }

        expect(result_by_id[user1.external_id][:role]).to eq("Owner")
        expect(result_by_id[user1.external_id][:isOwner]).to be(true)

        expect(result_by_id[user2.external_id][:role]).to eq("Admin")
        expect(result_by_id[user2.external_id][:isOwner]).to be(false)
      end
    end

    context "when filtering by lawyers" do
      it "returns only lawyers" do
        create(:company_administrator, company: company, user: user1)
        create(:company_lawyer, company: company, user: user2)

        result = presenter.users("lawyers")

        expect(result.length).to eq(1)
        expect(result.first[:id]).to eq(user2.external_id)
        expect(result.first[:role]).to eq("Lawyer")
      end
    end

    context "when filtering by contractors" do
      it "returns only contractors" do
        create(:company_administrator, company: company, user: user1)
        create(:company_worker, company: company, user: user2)

        result = presenter.users("contractors")

        expect(result.length).to eq(1)
        expect(result.first[:id]).to eq(user2.external_id)
        expect(result.first[:role]).to eq("Contractor")
        expect(result.first[:active]).to be(true)
      end
    end

    context "when filtering by investors" do
      it "returns only investors" do
        create(:company_administrator, company: company, user: user1)
        create(:company_investor, company: company, user: user2)

        result = presenter.users("investors")

        expect(result.length).to eq(1)
        expect(result.first[:id]).to eq(user2.external_id)
        expect(result.first[:role]).to eq("Investor")
      end
    end

    context "when filtering by multiple roles" do
      it "returns users from all specified roles" do
        create(:company_administrator, company: company, user: user1)
        create(:company_lawyer, company: company, user: user2)
        create(:company_worker, company: company, user: user3)
        create(:company_investor, company: company, user: user4)

        result = presenter.users("administrators,lawyers")

        expect(result.length).to eq(2)
        user_ids = result.map { |u| u[:id] }
        expect(user_ids).to contain_exactly(user1.external_id, user2.external_id)
      end

      it "removes duplicates when user has multiple roles in filter" do
        create(:company_administrator, company: company, user: user1)
        create(:company_lawyer, company: company, user: user1)
        create(:company_investor, company: company, user: user2)

        result = presenter.users("administrators,lawyers")

        expect(result.length).to eq(1)
        expect(result.first[:id]).to eq(user1.external_id)
        expect(result.first[:allRoles]).to contain_exactly("Admin", "Lawyer")
      end
    end

    context "when filter contains whitespace" do
      it "handles whitespace gracefully" do
        create(:company_administrator, company: company, user: user1)
        create(:company_lawyer, company: company, user: user2)

        result = presenter.users(" administrators , lawyers ")

        expect(result.length).to eq(2)
        user_ids = result.map { |u| u[:id] }
        expect(user_ids).to contain_exactly(user1.external_id, user2.external_id)
      end
    end

    context "when filter contains invalid roles" do
      it "ignores invalid roles and returns valid ones" do
        create(:company_administrator, company: company, user: user1)

        result = presenter.users("administrators,invalid_role")

        expect(result.length).to eq(1)
        expect(result.first[:id]).to eq(user1.external_id)
      end

      it "returns empty array when all roles are invalid" do
        create(:company_administrator, company: company, user: user1)

        result = presenter.users("invalid_role1,invalid_role2")

        expect(result).to eq([])
      end
    end

    context "when filter is empty string" do
      it "returns all users" do
        create(:company_administrator, company: company, user: user1)
        create(:company_lawyer, company: company, user: user2)

        result = presenter.users("")

        expect(result.length).to eq(2)
        user_ids = result.map { |u| u[:id] }
        expect(user_ids).to contain_exactly(user1.external_id, user2.external_id)
      end
    end

    context "when filter is nil" do
      it "returns all users" do
        create(:company_administrator, company: company, user: user1)
        create(:company_lawyer, company: company, user: user2)

        test_presenter = CompanyUsersPresenter.new(company: company)
        result = test_presenter.users(nil)

        expect(result.length).to eq(2)
        user_ids = result.map { |u| u[:id] }
        expect(user_ids).to contain_exactly(user1.external_id, user2.external_id)
      end
    end
  end
end
