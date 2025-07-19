import { expect, test } from "@playwright/test";
import type { BaseField } from "../../../frontend/utils/fieldGrouping";
import { groupFields } from "../../../frontend/utils/fieldGrouping";

const FIELD_GROUPS: string[][] = [
  ["abartn", "accountNumber"],
  ["address.state", "address.postCode"],
  ["firstName", "middleName", "lastName"],
];

test.describe("groupFields", () => {
  test("groups routing number and account number together", () => {
    const fields: BaseField[] = [{ key: "abartn" }, { key: "accountNumber" }, { key: "other" }];

    const result = groupFields(fields, FIELD_GROUPS);

    expect(result).toEqual([[{ key: "abartn" }, { key: "accountNumber" }], [{ key: "other" }]]);
  });

  test("groups address state and post code together", () => {
    const fields: BaseField[] = [{ key: "address.state" }, { key: "address.postCode" }, { key: "other" }];

    const result = groupFields(fields, FIELD_GROUPS);

    expect(result).toEqual([[{ key: "address.state" }, { key: "address.postCode" }], [{ key: "other" }]]);
  });

  test("groups three name fields together", () => {
    const fields: BaseField[] = [{ key: "firstName" }, { key: "middleName" }, { key: "lastName" }, { key: "other" }];

    const result = groupFields(fields, FIELD_GROUPS);

    expect(result).toEqual([[{ key: "firstName" }, { key: "middleName" }, { key: "lastName" }], [{ key: "other" }]]);
  });

  test("handles individual fields that are not part of groups", () => {
    const fields: BaseField[] = [{ key: "field1" }, { key: "field2" }, { key: "field3" }];

    const result = groupFields(fields, FIELD_GROUPS);

    expect(result).toEqual([[{ key: "field1" }], [{ key: "field2" }], [{ key: "field3" }]]);
  });

  test("handles complex grouping with pairs, triplets, and individual fields", () => {
    const fields: BaseField[] = [
      { key: "field1" },
      { key: "abartn" },
      { key: "field2" },
      { key: "accountNumber" },
      { key: "firstName" },
      { key: "address.state" },
      { key: "middleName" },
      { key: "field3" },
      { key: "lastName" },
      { key: "address.postCode" },
    ];

    const result = groupFields(fields, FIELD_GROUPS);

    expect(result).toEqual([
      [{ key: "field1" }],
      [{ key: "abartn" }, { key: "accountNumber" }],
      [{ key: "field2" }],
      [{ key: "firstName" }, { key: "middleName" }, { key: "lastName" }],
      [{ key: "address.state" }, { key: "address.postCode" }],
      [{ key: "field3" }],
    ]);
  });

  test("handles empty field array", () => {
    const fields: BaseField[] = [];

    const result = groupFields(fields, FIELD_GROUPS);

    expect(result).toEqual([]);
  });

  test("handles single field from a group", () => {
    const fields: BaseField[] = [{ key: "abartn" }, { key: "other" }];

    const result = groupFields(fields, FIELD_GROUPS);

    expect(result).toEqual([[{ key: "abartn" }], [{ key: "other" }]]);
  });

  test("handles partial three-field group", () => {
    const fields: BaseField[] = [{ key: "firstName" }, { key: "lastName" }, { key: "other" }];

    const result = groupFields(fields, FIELD_GROUPS);

    expect(result).toEqual([[{ key: "firstName" }, { key: "lastName" }], [{ key: "other" }]]);
  });
});
