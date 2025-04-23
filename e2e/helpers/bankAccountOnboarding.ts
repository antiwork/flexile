import { type Page } from "..";
import { selectComboboxOption } from ".";

type BankAccountFormValues = {
  legalName: string;
  city: string;
  country: string;
  streetAddress: string;
  state: string;
  zipCode: string;
  routingNumber: string;
  accountNumber: string;
};
export async function fillOutUsdBankAccountForm(page: Page, formValues: BankAccountFormValues) {
  await selectComboboxOption(page, "Currency", "USD (United States Dollar)");
  await page.getByLabel("Full name of the account holder").fill(formValues.legalName);
  await page.getByLabel("Routing number").fill(formValues.routingNumber);
  await page.getByLabel("Account number").fill(formValues.accountNumber);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Country").click();
  await page.getByRole("option", { name: formValues.country, exact: true }).click();
  await page.getByLabel("City").fill(formValues.city);
  await page.getByLabel("Street address, apt number").fill(formValues.streetAddress);
  await page.getByLabel("State").click();
  await page.getByRole("option", { name: formValues.state, exact: true }).click();
  await page.getByLabel("ZIP code").fill(formValues.zipCode);
}
