import Image from "next/image";
import flexileLogo from "@/images/flexile-logo.svg";

export default function Footer() {
  return (
    <footer className="mt-8 flex items-center justify-center gap-x-2 py-4 text-center text-sm text-gray-500">
      Powered by <Image src={flexileLogo} alt="Flexile Logo" width={80} height={24} className="h-6 w-auto" />
    </footer>
  );
}
