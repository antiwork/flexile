# frozen_string_literal: true

RSpec.describe GithubPolicy do
  subject { described_class }

  let(:company) { create(:company) }
  let(:user) { create(:user) }

  describe "user-level policies" do
    describe "#connect?" do
      context "when user is present" do
        it "grants access" do
          context = CurrentContext.new(user: user, company: nil)
          expect(subject.new(context, :github).connect?).to be true
        end
      end

      context "when user is nil" do
        it "denies access" do
          context = CurrentContext.new(user: nil, company: nil)
          expect(subject.new(context, :github).connect?).to be false
        end
      end
    end

    describe "#disconnect?" do
      context "when user has GitHub connected" do
        before do
          user.update!(github_uid: "12345")
        end

        it "grants access" do
          context = CurrentContext.new(user: user, company: nil)
          expect(subject.new(context, :github).disconnect?).to be true
        end
      end

      context "when user has no GitHub connection" do
        before do
          user.update!(github_uid: nil)
        end

        it "denies access" do
          context = CurrentContext.new(user: user, company: nil)
          expect(subject.new(context, :github).disconnect?).to be false
        end
      end

      context "when user is nil" do
        it "denies access" do
          context = CurrentContext.new(user: nil, company: nil)
          expect(subject.new(context, :github).disconnect?).to be false
        end
      end
    end

    describe "#fetch_pr?" do
      context "when user is present" do
        it "grants access" do
          context = CurrentContext.new(user: user, company: nil)
          expect(subject.new(context, :github).fetch_pr?).to be true
        end
      end

      context "when user is nil" do
        it "denies access" do
          context = CurrentContext.new(user: nil, company: nil)
          expect(subject.new(context, :github).fetch_pr?).to be false
        end
      end
    end
  end

  describe "company-level policies" do
    describe "#manage_org?" do
      context "when user is a company administrator" do
        let(:company_administrator) { create(:company_administrator, company: company, user: user) }

        it "grants access" do
          context = CurrentContext.new(user: user, company: company)
          # Need to set company_administrator on context
          allow(context).to receive(:company_administrator).and_return(company_administrator)
          allow(context).to receive(:company_administrator?).and_return(true)

          expect(subject.new(context, :github).manage_org?).to be true
        end
      end

      context "when user is a company worker (not admin)" do
        let(:company_worker) { create(:company_worker, company: company, user: user) }

        it "denies access" do
          context = CurrentContext.new(user: user, company: company)

          expect(subject.new(context, :github).manage_org?).to be false
        end
      end

      context "when user has no role in company" do
        it "denies access" do
          context = CurrentContext.new(user: user, company: company)

          expect(subject.new(context, :github).manage_org?).to be false
        end
      end

      context "when user is nil" do
        it "denies access" do
          context = CurrentContext.new(user: nil, company: company)

          expect(subject.new(context, :github).manage_org?).to be false
        end
      end
    end
  end
end
