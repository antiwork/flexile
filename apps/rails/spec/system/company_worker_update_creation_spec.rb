# frozen_string_literal: true

RSpec.describe "Creating a company worker update" do
  let(:company) { create(:company) }
  let(:company_worker) { create(:company_worker, company:) }
  let(:user) { company_worker.user }
  let(:period) { CompanyWorkerUpdatePeriod.new }

  before do
    company.update!(team_updates_enabled: true)
    sign_in user
  end

  def add_task(task_description)
    input = find_field(placeholder: "Describe your task", with: "")
    input.fill_in(with: task_description)
    input.native.send_keys(:return)
  end

  def toggle_task_completion(task_description)
    within(find_field("Describe your task", with: task_description).find(:xpath, "./ancestor::div[contains(@class, 'task-input')]")) do
      find("input[type='checkbox']").check
    end
  end

  def remove_task(task_description)
    within(find_field("Describe your task", with: task_description).find(:xpath, "./ancestor::div[contains(@class, 'task-input')]")) do
      find("button[aria-label='Remove']").click
    end
  end

  def add_absence(starts_on: nil, ends_on: nil)
    if all("input[type='date'][id^='absence-start-date']").none? { |input| input.value.blank? }
      click_button "Add more"
    end
    start_input = find_all("input[type='date'][id^='absence-start-date']").find { |input| input.value.blank? }
    end_input = find_all("input[type='date'][id^='absence-end-date']").find { |input| input.value.blank? }

    start_input.set(starts_on&.strftime("%m/%d/%Y")) if starts_on
    end_input.set(ends_on&.strftime("%m/%d/%Y")) if ends_on
  end

  def remove_absence(index:)
    all("button[aria-label='Remove']")[index].click
  end

  def update_absence(index:, starts_on: nil, ends_on: nil)
    all("input[type='date'][id^='absence-start-date']")[index].set(starts_on&.strftime("%m/%d/%Y") || "")
    all("input[type='date'][id^='absence-end-date']")[index].set(ends_on&.strftime("%m/%d/%Y") || "")
  end

  it "allows a company worker to create a weekly update", :vcr do
    expect(CreateOrUpdateCompanyWorkerUpdates).to be_performed_with(
      company_worker: an_instance_of(CompanyWorker),
      prev_update_params: {
        id: nil,
        period_starts_on: period.prev_period_starts_on.to_s,
        tasks: [
          { description: "Complete project A", completed: true, id: nil },
          { description: "Start project B", completed: false, id: nil },
          { description: "", completed: false, id: nil },
        ],
      },
      current_update_params: {
        id: nil,
        period_starts_on: period.starts_on.to_s,
        tasks: [
          { description: "Continue project B", completed: false, id: nil },
          { description: "Begin project C", completed: false, id: nil },
          { description: "", completed: false, id: nil },
        ],
      },
      absences_params: [{ id: nil, starts_on: nil, ends_on: nil }],
    )

    visit spa_company_updates_contractor_path(company.external_id)

    expect(page).to have_text("Your weekly update")

    within("form", text: "What did you get done last week?") do
      add_task("Complete project A")
      add_task("Start project B")
      toggle_task_completion("Complete project A")
    end

    within("form", text: "What are you doing this week?") do
      add_task("Continue project B")
      add_task("Begin project C")
    end

    expect do
      click_button "Post update"
      wait_for_ajax
    end.to change { company_worker.reload.company_worker_updates.count }.by(2)
  end

  context "when a prior update exists" do
    let(:task_1) { create(:task, company_worker:, name: "Complete project A") }
    let(:task_2) { create(:task, company_worker:, name: "Start project B") }
    let!(:prev_update) do
      create(:company_worker_update, :for_prior_period, company_worker:, tasks: [task_1, task_2])
    end

    it "allows a company worker to edit their prior update" do
      expect(CreateOrUpdateCompanyWorkerUpdates).to be_performed_with(
        company_worker: an_instance_of(CompanyWorker),
        prev_update_params: {
          id: prev_update.id,
          period_starts_on: period.prev_period_starts_on.to_s,
          tasks: [
            { description: "Complete project A", completed: true, id: task_1.id },
            { description: "Scope project C", completed: false, id: nil },
            { description: "", completed: false, id: nil }
          ],
        },
        current_update_params: {
          id: nil,
          period_starts_on: period.starts_on.to_s,
          tasks: [
            { description: "Continue project B", completed: false, id: nil },
            { description: "Begin project C", completed: false, id: nil },
            { description: "", completed: false, id: nil }
          ],
        },
        absences_params: [{ id: nil, starts_on: nil, ends_on: nil }],
      )

      visit spa_company_updates_contractor_path(company.external_id)

      within("form", text: "What did you get done last week?") do
        toggle_task_completion("Complete project A")
        remove_task("Start project B")
        add_task("Scope project C")
      end

      within("form", text: "What are you doing this week?") do
        add_task("Continue project B")
        add_task("Begin project C")
      end

      expect do
        click_button "Post update"
        wait_for_ajax
      end.to change { company_worker.reload.company_worker_updates.count }.by(1)
    end
  end

  context "when a current update exists" do
    let(:task_1) { create(:task, company_worker:, name: "Complete project A") }
    let(:task_2) { create(:task, company_worker:, name: "Start project B") }
    let(:task_3) { create(:task, company_worker:, name: "Scope project C") }
    let(:task_4) { create(:task, company_worker:, name: "Complete project B") }
    let(:task_5) { create(:task, company_worker:, name: "Start project C") }
    let!(:prev_update) do
      create(:company_worker_update, :for_prior_period, company_worker:, tasks: [task_1, task_2, task_3])
    end
    let!(:current_update) do
      create(:company_worker_update, company_worker:, tasks: [task_4, task_5])
    end

    it "allows a company worker to edit their current update" do
      expect(CreateOrUpdateCompanyWorkerUpdates).to be_performed_with(
        company_worker: an_instance_of(CompanyWorker),
        prev_update_params: {
          id: prev_update.id,
          period_starts_on: period.prev_period_starts_on.to_s,
          tasks: [
            { description: "Complete project A", completed: false, id: task_1.id },
            { description: "Scope project C", completed: true, id: task_3.id },
            { description: "Support tickets", completed: false, id: nil },
            { description: "", completed: false, id: nil }
          ],
        },
        current_update_params: {
          id: current_update.id,
          period_starts_on: period.starts_on.to_s,
          tasks: [
            { description: "Complete project B", completed: true, id: task_4.id },
            { description: "Start project C", completed: false, id: task_5.id },
            { description: "PR reviews", completed: false, id: nil },
            { description: "", completed: false, id: nil }
          ],
        },
        absences_params: [{ id: nil, starts_on: nil, ends_on: nil }],
      )

      visit spa_company_updates_contractor_path(company.external_id)

      within("form", text: "What did you get done last week?") do
        remove_task("Start project B")
        toggle_task_completion("Scope project C")
        add_task("Support tickets")
      end

      within("form", text: "What are you doing this week?") do
        toggle_task_completion("Complete project B")
        add_task("PR reviews")
      end

      expect do
        click_button "Save update"
        wait_for_ajax
      end.to change { company_worker.reload.company_worker_updates.count }.by(0)
    end
  end

  describe "updating current and future absences" do
    let!(:absence_1) do
      create(:company_worker_absence, company_worker:, starts_on: period.starts_on + 1.day, ends_on: period.starts_on + 3.days)
    end
    let!(:absence_2) do
      create(:company_worker_absence, company_worker:, starts_on: period.ends_on - 1.day, ends_on: period.ends_on + 7.days)
    end
    let!(:older_absence) do
      create(:company_worker_absence, company_worker:, starts_on: 1.year.ago, ends_on: 1.year.ago + 1.day) # remains unchanged
    end

    it "allows a company worker to edit their current and future absences" do
      expect(CreateOrUpdateCompanyWorkerUpdates).to be_performed_with(
        company_worker: an_instance_of(CompanyWorker),
        current_update_params: {
          id: nil,
          period_starts_on: period.starts_on.to_s,
          tasks: [{ description: nil, completed: false, id: nil }],
        },
        prev_update_params: {
          id: nil,
          period_starts_on: period.prev_period_starts_on.to_s,
          tasks: [{ description: nil, completed: false, id: nil }],
        },
        absences_params: [
          { id: absence_2.id, starts_on: (period.ends_on + 2.days).to_s, ends_on: (period.ends_on + 1.week).to_s },
          { id: nil, starts_on: (period.ends_on + 2.weeks).to_s, ends_on: (period.ends_on + 3.weeks).to_s },
          { id: nil, starts_on: (period.ends_on + 1.month).to_s, ends_on: (period.ends_on + 2.months).to_s },
        ],
      )

      visit spa_company_updates_contractor_path(company.external_id)

      within("form", text: "Time off") do
        remove_absence(index: 0)
        update_absence(index: 0, starts_on: period.ends_on + 2.days, ends_on: period.ends_on + 1.week)
        add_absence(starts_on: period.ends_on + 2.weeks, ends_on: period.ends_on + 3.weeks)
        add_absence(starts_on: period.ends_on + 1.month, ends_on: period.ends_on + 2.months)
      end

      expect do
        click_button "Post update"
        wait_for_ajax
      end.to change { company_worker.reload.company_worker_absences.count }.by(1)
    end

    describe "validations" do
      it "does not allow overlapping absences" do
        visit spa_company_updates_contractor_path(company.external_id)

        within("form", text: "Time off") do
          add_absence(starts_on: Date.today, ends_on: Date.today + 5.days)
          add_absence(starts_on: Date.today + 3.days, ends_on: Date.today + 7.days)
        end

        click_button "Post update"
        wait_for_ajax

        expect(page).to have_text("Absence periods cannot overlap")

        within("form", text: "Time off") do
          update_absence(index: 1, starts_on: Date.today + 2.weeks, ends_on: Date.today + 3.weeks)
        end

        expect(page).not_to have_text("Absence periods cannot overlap")
      end

      it "does not allow absences that end before they start" do
        visit spa_company_updates_contractor_path(company.external_id)

        within("form", text: "Time off") do
          update_absence(index: 0, starts_on: Date.today + 5.days, ends_on: Date.today)
        end

        click_button "Post update"

        expect(page).to have_text("End date must be on or after start date")

        within("form", text: "Time off") do
          update_absence(index: 0, starts_on: Date.today + 1.day, ends_on: Date.today + 5.days)
        end

        expect(page).not_to have_text("End date must be on or after start date")
      end

      it "does not allow absences without both a start and end date" do
        visit spa_company_updates_contractor_path(company.external_id)

        within("form", text: "Time off") do
          add_absence(starts_on: Date.today)
        end

        click_button "Post update"

        expect(page).to have_text("Please provide both start and end dates for absences")

        within("form", text: "Time off") do
          update_absence(index: -1, starts_on: Date.today, ends_on: Date.today + 5.days)
          add_absence(ends_on: Date.today + 10.days)
        end

        click_button "Post update"

        expect(page).to have_text("Please provide both start and end dates for absences")

        within("form", text: "Time off") do
          update_absence(index: -1, starts_on: Date.today + 10.days, ends_on: Date.today + 10.days)
        end

        expect(page).not_to have_text("Please provide both start and end dates for absences")
      end
    end
  end
end
