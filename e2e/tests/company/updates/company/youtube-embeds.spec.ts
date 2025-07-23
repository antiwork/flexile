import { expect, type Locator, type Page, test } from "@playwright/test";
import { companiesFactory } from "@test/factories/companies";
import { companyUpdatesFactory } from "@test/factories/companyUpdates";
import { login } from "@test/helpers/auth";

const ANTIWORK_VIDEO = {
  id: "qaTy2klHNuI",
  fullUrl: "https://www.youtube.com/watch?v=qaTy2klHNuI",
  shortUrl: "https://youtu.be/qaTy2klHNuI",
};

async function assertYouTubeIframeLoaded(page: Page, videoId: string): Promise<Locator> {
  const iframe = page.locator('iframe[src*="youtube.com/embed"]');
  const expectedSrc = `https://www.youtube.com/embed/${videoId}?controls=0&rel=0`;

  await expect(iframe).toBeVisible();
  await expect(iframe).toHaveAttribute("src", expectedSrc);
  await expect(iframe).toHaveAttribute("title", "YouTube video player");
  await expect(iframe).toHaveAttribute("allowfullscreen");
  await expect(iframe).toHaveAttribute("allow", "clipboard-write; encrypted-media; picture-in-picture;");
  await expect(iframe).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  await expect(iframe).toHaveClass(/size-full/u);

  const iframeParent = iframe.locator("..");
  await expect(iframeParent).toHaveClass(/aspect-video/u);

  return iframe;
}

async function assertNoCSPBlocking(page: Page): Promise<void> {
  await expect(page.getByText("This content is blocked. Contact the site owner to fix the issue.")).not.toBeVisible();
}

async function waitForIframeLoad(iframe: Locator): Promise<void> {
  await iframe.waitFor({ state: "attached" });
  await expect(iframe).toBeVisible();
}

test.describe("Company Updates - YouTube Embeds", () => {
  let company: Awaited<ReturnType<typeof companiesFactory.createCompletedOnboarding>>["company"];
  let adminUser: Awaited<ReturnType<typeof companiesFactory.createCompletedOnboarding>>["adminUser"];

  test.beforeEach(async () => {
    const result = await companiesFactory.createCompletedOnboarding({
      companyUpdatesEnabled: true,
    });
    company = result.company;
    adminUser = result.adminUser;
  });

  test("should display YouTube embed for youtube.com URLs", async ({ page }) => {
    const { companyUpdate } = await companyUpdatesFactory.createWithYouTubeVideo(ANTIWORK_VIDEO.fullUrl, {
      companyId: company.id,
      title: "Company Update with YouTube Video",
      body: "<p>This update includes a YouTube video.</p>",
      sentAt: new Date(),
    });

    await login(page, adminUser);
    await page.goto(`/updates/company/${companyUpdate.externalId}`);

    await expect(page.getByText(companyUpdate.title)).toBeVisible();
    await expect(page.getByText("This update includes a YouTube video.")).toBeVisible();

    const iframe = await assertYouTubeIframeLoaded(page, ANTIWORK_VIDEO.id);
    await assertNoCSPBlocking(page);
    await waitForIframeLoad(iframe);
  });

  test("should display YouTube embed for youtu.be URLs", async ({ page }) => {
    const { companyUpdate } = await companyUpdatesFactory.createWithYouTubeVideo(ANTIWORK_VIDEO.shortUrl, {
      companyId: company.id,
      title: "Company Update with Short YouTube URL",
      sentAt: new Date(),
    });

    await login(page, adminUser);
    await page.goto(`/updates/company/${companyUpdate.externalId}`);

    const iframe = await assertYouTubeIframeLoaded(page, ANTIWORK_VIDEO.id);
    await assertNoCSPBlocking(page);
    await waitForIframeLoad(iframe);
  });

  test("should not display video section when no video URL is provided", async ({ page }) => {
    const { companyUpdate } = await companyUpdatesFactory.create({
      companyId: company.id,
      title: "Company Update without Video",
      videoUrl: null,
      sentAt: new Date(),
    });

    await login(page, adminUser);
    await page.goto(`/updates/company/${companyUpdate.externalId}`);

    await expect(page.locator('iframe[src*="youtube.com/embed"]')).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Watch the video" })).not.toBeVisible();
  });

  test("should allow creating company update with YouTube URL", async ({ page }) => {
    await login(page, adminUser);
    await page.goto("/updates/company/new");

    await expect(page.getByLabel("Title")).toBeVisible();
    await expect(page.getByLabel("Video URL (optional)")).toBeVisible();

    await page.getByLabel("Title").fill("Test Update with YouTube Video");
    await page.getByLabel("Video URL (optional)").fill(ANTIWORK_VIDEO.fullUrl);

    await expect(page.getByLabel("Title")).toHaveValue("Test Update with YouTube Video");
    await expect(page.getByLabel("Video URL (optional)")).toHaveValue(ANTIWORK_VIDEO.fullUrl);
  });

  test("should handle YouTube URLs with additional parameters", async ({ page }) => {
    const urlWithParams = `${ANTIWORK_VIDEO.fullUrl}&t=30s`;
    const { companyUpdate } = await companyUpdatesFactory.create({
      companyId: company.id,
      title: "YouTube URL with Parameters",
      videoUrl: urlWithParams,
      sentAt: new Date(),
    });

    await login(page, adminUser);
    await page.goto(`/updates/company/${companyUpdate.externalId}`);

    const iframe = await assertYouTubeIframeLoaded(page, ANTIWORK_VIDEO.id);
    await assertNoCSPBlocking(page);
    await waitForIframeLoad(iframe);
  });

  test("should show fallback link for malformed YouTube URLs", async ({ page }) => {
    const malformedUrl = "https://www.youtube.com/watch"; // No video ID
    const { companyUpdate } = await companyUpdatesFactory.create({
      companyId: company.id,
      title: "Malformed YouTube URL",
      videoUrl: malformedUrl,
      sentAt: new Date(),
    });

    await login(page, adminUser);
    await page.goto(`/updates/company/${companyUpdate.externalId}`);

    await expect(page.locator('iframe[src*="youtube.com/embed"]')).not.toBeVisible();

    const videoLink = page.getByRole("link", { name: "Watch the video" });
    await expect(videoLink).toBeVisible();
    await expect(videoLink).toHaveAttribute("href", malformedUrl);
    await expect(videoLink).toHaveAttribute("target", "_blank");
    await expect(videoLink).toHaveAttribute("rel", "noreferrer");
  });
});
