interface TableRowSelector {
  query(root: HTMLElement, selector: string): Element | null;
  queryAll(root: HTMLElement, selector: string): Element[];
}

export function serializeColumnValues(columnValues: Record<string, string | RegExp>): string {
  const regexPrefix = "__REGEX__";
  const regexSeparator = "||";
  const defaultFlags = "u";

  return JSON.stringify(
    Object.entries(columnValues).reduce<Record<string, string>>(
      (result, [columnName, columnValue]) => ({
        ...result,
        [columnName]:
          columnValue instanceof RegExp
            ? `${regexPrefix}${columnValue.source}${regexSeparator}${Array.from(new Set(`${defaultFlags}${columnValue.flags}`)).join("")}`
            : columnValue,
      }),
      {},
    ),
  );
}

export function createTableRowEngine(): TableRowSelector {
  const regexPrefix = "__REGEX__";
  const regexSeparator = "||";
  const defaultFlags = "u";

  function findMatchingRows(root: HTMLElement, selector: string, options: { findAll: false }): Element | null;
  function findMatchingRows(root: HTMLElement, selector: string, options: { findAll: true }): Element[];
  function findMatchingRows(
    root: HTMLElement,
    selector: string,
    options: { findAll: boolean },
  ): Element | Element[] | null {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- serializeColumnValues is type safe
      const searchCriteria: Record<string, string> = JSON.parse(selector);

      const targetTable: HTMLElement | null = root.tagName === "TABLE" ? root : root.querySelector("table");
      if (!targetTable) return options.findAll ? [] : null;

      const headerCells = Array.from(targetTable.querySelectorAll("thead th"));
      const columnNameToIndexMap = headerCells.reduce((map, headerCell, columnIndex) => {
        const headerText = (headerCell.textContent || "").trim();
        if (headerText) map.set(headerText, columnIndex);
        return map;
      }, new Map<string, number>());

      const rowsToCheck = targetTable.querySelectorAll("tbody tr");
      const matchingRows = Array.from(rowsToCheck).filter((tableRow) => {
        const rowCells = tableRow.querySelectorAll("td");
        return Object.entries(searchCriteria).every(([columnName, expectedValue]) => {
          const columnIndex = columnNameToIndexMap.get(columnName);
          if (columnIndex === undefined) return false;

          const cell = rowCells[columnIndex];
          if (!cell) return false;

          const actualCellValue = (cell.textContent ?? "").trim();
          if (expectedValue.startsWith(regexPrefix)) {
            const regexContent = expectedValue.slice(regexPrefix.length);
            const regexParts = regexContent.includes(regexSeparator)
              ? regexContent.split(regexSeparator, 2)
              : [regexContent];
            const regexPattern = regexParts[0] ?? "";
            const regexFlags = regexParts[1] || defaultFlags;

            const compiledRegex = new RegExp(regexPattern, regexFlags);
            return compiledRegex.test(actualCellValue);
          }
          return actualCellValue.includes(expectedValue);
        });
      });

      return options.findAll ? matchingRows : (matchingRows[0] ?? null);
    } catch {
      return options.findAll ? [] : null;
    }
  }

  return {
    query(root: HTMLElement, selector: string): Element | null {
      return findMatchingRows(root, selector, { findAll: false });
    },
    queryAll(root: HTMLElement, selector: string): Element[] {
      return findMatchingRows(root, selector, { findAll: true });
    },
  };
}
