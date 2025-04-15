"use client";

import { ArrowRightIcon } from "@heroicons/react/24/outline";
import type { Route } from "next";
import Link from "next/link";
import * as React from "react";
import { cn } from "@/utils";
import { Card, CardContent } from "./card";

interface CardLinkProps<T extends string> {
  href: Route<T>;
  title: string;
  description?: string;
  className?: string;
}

function CardLink<T extends string>({ className, title, description, href, ...props }: CardLinkProps<T>) {
  return (
    <Link href={href} className={cn("block no-underline", className)} {...props}>
      <Card className="hover:bg-muted/50 transition-colors">
        <CardContent className="grid grid-cols-[1fr_auto] items-center p-4">
          <div className="grid gap-1">
            <h4 className="text-xl font-semibold">{title}</h4>
            {description ? <p className="text-muted-foreground line-clamp-2">{description}</p> : null}
          </div>
          <ArrowRightIcon className="text-muted-foreground size-6" />
        </CardContent>
      </Card>
    </Link>
  );
}

export { CardLink };
