# frozen_string_literal: true

module CompanyWorkerUpdateHelpers
  def displays_update_with_contractor(company_worker_update, absences = [])
    company_worker = company_worker_update.company_worker
    if user.company_administrator_for?(company)
      expect(page).to have_link(
        company_worker.user.display_name,
        href: Rails.application.routes.url_helpers.spa_company_worker_path(company.external_id, company_worker.external_id, selectedTab: "updates")
      )
    else
      expect(page).to have_text(company_worker.user.display_name)
      expect(page).not_to have_link(company_worker.user.display_name)
    end
    displays_update_card(company_worker_update, absences)
  end

  def displays_update_card(company_worker_update, absences = [])
    expect(page).to have_text("Posted on #{company_worker_update.published_at.strftime("%A, %b %-d")}")
    company_worker_update.tasks.each do |task|
      expect(page).to have_text(task.name)
    end
    expect(page).to have_text("Off #{formatted_absence_weekdays(company_worker_update, absences)}") if absences.any?
  end

  def formatted_absence_date_range(absence)
    start_date = absence.starts_on
    end_date = absence.ends_on
    current_year = Date.current.year
    start_year = start_date.year
    end_year = end_date.year

    format_string = "%a, %b %-d"
    if start_date == end_date
      start_date.strftime(start_year != current_year ? "#{format_string}, %Y" : format_string)
    else
      start_formatted = start_date.strftime(start_year != end_year ? "#{format_string}, %Y" : format_string)
      end_formatted = end_date.strftime(end_year != current_year ? "#{format_string}, %Y" : format_string)
      "#{start_formatted} - #{end_formatted}"
    end
  end

  def formatted_absence_weekdays(update, absences)
    return "" if absences.empty?

    absences.map do |absence|
      absence_start = [absence.starts_on, update.period_starts_on].max
      absence_end = [absence.ends_on, update.period_ends_on].min

      start_weekday = absence_start.strftime("%a")
      end_weekday = absence_start == absence_end ? "" : "-#{absence_end.strftime("%a")}"
      "#{start_weekday}#{end_weekday}"
    end.join(", ")
  end

  def displays_update_item_with_github_link(task)
    github_integration_record = task.github_integration_record
    expect(page).to have_link(github_integration_record.description, href: github_integration_record.url)
  end
end
