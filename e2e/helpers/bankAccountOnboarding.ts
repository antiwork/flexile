import { type Page } from "../index";
import { fillCombobox } from "./combobox";

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
  await page.getByLabel("Currency").selectOption("USD (United States Dollar)");
  await page.getByLabel("Full name of the account holder").fill(formValues.legalName);
  await page.getByLabel("Routing number").fill(formValues.routingNumber);
  await page.getByLabel("Account number").fill(formValues.accountNumber);
  await page.getByRole("button", { name: "Continue" }).click();
  await fillCombobox(page, "Country", formValues.country);
  await page.getByLabel("City").fill(formValues.city);
  await page.getByLabel("Street address, apt number").fill(formValues.streetAddress);
  await page.getByLabel("State").fill(formValues.state);
  await page.getByLabel("ZIP code").fill(formValues.zipCode);
}
