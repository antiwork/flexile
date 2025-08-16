import { Md5 } from "@smithy/md5-js";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const e =
  <T extends React.SyntheticEvent>(cb: (e: T) => void, ...actions: ("stop" | "prevent")[]) =>
  (e: T) => {
    for (const action of actions) {
      switch (action) {
        case "stop":
          e.stopPropagation();
          break;
        case "prevent":
          e.preventDefault();
          break;
      }
    }
    cb(e);
  };

export function download(type: string, filename: string, contents: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export function toSlug(str: string) {
  return str
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "") // remove accents and umlauts
    .replace(/[_\W]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

export const md5Checksum = async (file: File) => {
  const md5 = new Md5();
  md5.update(await file.arrayBuffer());
  return btoa(String.fromCharCode(...(await md5.digest())));
};

export const formatFileSize = (size: number) => {
  const units = ["byte", "kilobyte", "megabyte", "gigabyte", "terabyte", "petabyte"];
  const i = size === 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
  return (size / 1024 ** i).toLocaleString([], {
    notation: "compact",
    style: "unit",
    unit: `${units[i]}`,
    unitDisplay: "narrow",
  });
};
