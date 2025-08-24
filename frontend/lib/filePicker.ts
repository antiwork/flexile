export function openFilePicker(accept: string): Promise<File> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = false;

    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files?.length !== 1 || !target.files?.[0]) return;
      resolve(target.files[0]);
    };

    input.click();
  });
}
