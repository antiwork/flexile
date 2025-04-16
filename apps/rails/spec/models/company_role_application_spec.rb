# frozen_string_literal: true

RSpec.describe CompanyRoleApplication do
  describe "associations" do
    it { is_expected.to belong_to(:company_role) }
  end

  describe "delegations" do
    it { is_expected.to delegate_method(:hourly?).to(:company_role).allow_nil }
  end

  describe "validations" do
    it { is_expected.to validate_inclusion_of(:status).in_array(described_class.statuses.values) }
    it { is_expected.to validate_presence_of(:name) }
    it { is_expected.to validate_presence_of(:country_code) }
    it { is_expected.to validate_presence_of(:description) }
    it { is_expected.to validate_presence_of(:equity_percent) }
    it { is_expected.to validate_numericality_of(:equity_percent).is_greater_than_or_equal_to(0).only_integer }
    it { is_expected.to allow_value("test@example.com").for(:email) }
    it { is_expected.not_to allow_value("invalid_email").for(:email) }

    context "when the company role pay rate type is hourly" do
      let(:company_role_application) { build(:company_role_application) }

      it "validates the hours_per_week" do
        expect(company_role_application).to validate_presence_of(:hours_per_week)
        expect(company_role_application).to validate_numericality_of(:hours_per_week).is_greater_than_or_equal_to(0).only_integer
      end

      it "validates the weeks_per_year" do
        expect(company_role_application).to validate_presence_of(:weeks_per_year)
        expect(company_role_application).to validate_numericality_of(:weeks_per_year).is_greater_than_or_equal_to(0).only_integer
      end
    end

    context "when the company role pay rate type is project-based" do
      let(:company_role_application) { build(:company_role_application, company_role: create(:project_based_company_role)) }

      it "does not validate the hours_per_week" do
        expect(company_role_application).not_to validate_presence_of(:hours_per_week)
        expect(company_role_application).not_to validate_numericality_of(:hours_per_week)
      end

      it "does not validate the weeks_per_year" do
        expect(company_role_application).not_to validate_presence_of(:weeks_per_year)
        expect(company_role_application).not_to validate_numericality_of(:weeks_per_year)
      end
    end

    context "when the company role pay rate type is salary" do
      let(:company_role_application) { build(:company_role_application, company_role: create(:salary_company_role)) }

      it "does not validate the hours_per_week" do
        expect(company_role_application).not_to validate_presence_of(:hours_per_week)
        expect(company_role_application).not_to validate_numericality_of(:hours_per_week)
      end

      it "does not validate the weeks_per_year" do
        expect(company_role_application).not_to validate_presence_of(:weeks_per_year)
        expect(company_role_application).not_to validate_numericality_of(:weeks_per_year)
      end
    end
  end

  describe "concerns" do
    it "includes Deletable" do
      expect(described_class.ancestors).to include(Deletable)
    end
  end

  describe "country validation" do
    context "when the country is in the SUPPORTED_COUNTRY_CODES" do
      it "is valid" do
        application = create(:company_role_application, country_code: "US")
        expect(application).to be_valid
      end
    end

    context "when the country is not in the SUPPORTED_COUNTRY_CODES" do
      let(:country_code) { "NG" }

      it "is invalid" do
        application = build(:company_role_application, country_code:)
        expect(application).to be_invalid
        expect(application.errors[:country_code]).to include("is not included in the list")
      end
    end
  end

  describe "normalizations" do
    it "normalizes fields" do
      application = build(
        :company_role_application,
        name: "  Joe   Doe  ",
        email: "  TEST@example.com ",
        description: "  Example description   "
      )
      expect(application.name).to eq("Joe Doe")
      expect(application.email).to eq("test@example.com")
      expect(application.description).to eq("Example description")
    end
  end

  describe "#display_country" do
    it "returns the country of the applicant" do
      application = build(:company_role_application, country_code: "CA")
      expect(application.display_country).to eq("Canada")

      application.country_code = "JP"
      expect(application.display_country).to eq("Japan")

      application.country_code = "RO"
      expect(application.display_country).to eq("Romania")
    end
  end
end
