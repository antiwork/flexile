# frozen_string_literal: true

RSpec.describe Current do
  describe "#user=" do
    it "sets the user and updates whodunnit" do
      user = create(:user)

      Current.user = user

      expect(Current.user).to eq(user)
      expect(Current.whodunnit).to eq(user.id)
    end

    it "sets whodunnit to nil when user is nil" do
      Current.user = nil

      expect(Current.user).to be_nil
      expect(Current.whodunnit).to be_nil
    end
  end

  describe "#whodunnit=" do
    it "sets whodunnit and updates PaperTrail.request.whodunnit" do
      whodunnit = 123

      Current.whodunnit = whodunnit

      expect(Current.whodunnit).to eq(whodunnit)
      expect(PaperTrail.request.whodunnit).to eq(whodunnit)
    end
  end

  describe "#company_administrator!" do
    let(:user) { create(:user) }
    let(:company) { create(:company) }

    context "when there is no company worker" do
      it "raises an error" do
        Current.user = user
        Current.company = company

        expect { Current.company_administrator! }.to raise_error(ActiveRecord::RecordNotFound)
      end
    end

    context "when there is a company worker" do
      it "returns the company worker" do
        Current.user = user
        Current.company = company
        Current.company_administrator = create(:company_administrator, user: user, company: company)

        expect(Current.company_administrator!).to eq(Current.company_administrator)
      end
    end
  end

  describe "#company_worker!" do
    let(:user) { create(:user) }
    let(:company) { create(:company) }

    context "when there is no company worker" do
      it "raises an error" do
        Current.user = user
        Current.company = company

        expect { Current.company_worker! }.to raise_error(ActiveRecord::RecordNotFound)
      end
    end

    context "when there is a company worker" do
      it "returns the company worker" do
        Current.user = user
        Current.company = company
        Current.company_worker = create(:company_worker, user: user, company: company)

        expect(Current.company_worker!).to eq(Current.company_worker)
      end
    end
  end

  describe "#company_investor!" do
    let(:user) { create(:user) }
    let(:company) { create(:company) }

    context "when there is no company worker" do
      it "raises an error" do
        Current.user = user
        Current.company = company

        expect { Current.company_investor! }.to raise_error(ActiveRecord::RecordNotFound)
      end
    end

    context "when there is a company worker" do
      it "returns the company worker" do
        Current.user = user
        Current.company = company
        Current.company_investor = create(:company_investor, user: user, company: company)

        expect(Current.company_investor!).to eq(Current.company_investor)
      end
    end
  end

  describe "#company_lawyer!" do
    let(:user) { create(:user) }
    let(:company) { create(:company) }

    context "when there is no company worker" do
      it "raises an error" do
        Current.user = user
        Current.company = company

        expect { Current.company_lawyer! }.to raise_error(ActiveRecord::RecordNotFound)
      end
    end

    context "when there is a company worker" do
      it "returns the company worker" do
        Current.user = user
        Current.company = company
        Current.company_lawyer = create(:company_lawyer, user: user, company: company)

        expect(Current.company_lawyer!).to eq(Current.company_lawyer)
      end
    end
  end

  describe "#company_administrator?" do
    it "returns true if the user is a company administrator" do
      Current.company_administrator = create(:company_administrator)
      expect(Current.company_administrator?).to be_truthy
    end

    it "returns false if the user is not a company administrator" do
      expect(Current.company_administrator?).to be_falsey
    end
  end
end
