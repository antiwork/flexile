import { Paperclip } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { cn } from "@/utils";
import { Card, CardContent } from "./ui/card";
import { Separator } from "./ui/separator";

interface ListItem {
  key: string;
  filename: string;
  label: React.ReactNode;
  right?: React.ReactNode;
}

interface AttachmentListCardProps {
  title: string;
  items: ListItem[];
  linkClasses: string;
}

export default function AttachmentListCard({ title, items, linkClasses }: AttachmentListCardProps) {
  if (items.length === 0) return null;

  return (
    <Card className="border-none print:my-3 print:border print:border-gray-300 print:bg-white print:p-2">
      <CardContent className="px-0">
        <div className="text-muted-foreground px-4 text-sm font-medium">{title}</div>
        {items.map((item, i) => (
          <Fragment key={i}>
            <Separator className="my-2 h-[0.5px] print:my-1.5 print:border-t print:border-gray-200" />
            <div className="flex justify-between gap-2 px-4 text-sm">
              <Link
                href={`/download/${item.key}/${item.filename}`}
                download
                className={cn(linkClasses, "print:text-black print:no-underline")}
              >
                <Paperclip className="inline size-4 print:hidden" />
                {item.label}
              </Link>
              {item.right}
            </div>
          </Fragment>
        ))}
      </CardContent>
    </Card>
  );
}
