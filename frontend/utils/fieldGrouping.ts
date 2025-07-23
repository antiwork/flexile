import { cloneDeep, partition } from "lodash-es";

export interface BaseField {
  key: string;
}

export function groupFields<T extends BaseField>(fields: T[], fieldGroups: string[][]): T[][] {
  const result: T[][] = [];

  // ensures the original fields param is not mutated
  let allFields: T[] = cloneDeep(fields);

  while (allFields.length > 0) {
    const fieldGroup = fieldGroups.find((group) => group[0] === allFields[0]?.key);
    if (fieldGroup) {
      const [matchedFields, otherFields] = partition(allFields, (field) => fieldGroup.includes(field.key));
      result.push(matchedFields);
      allFields = otherFields;
    } else {
      result.push(allFields.splice(0, 1));
    }
  }

  return result;
}
