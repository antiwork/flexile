"use client";
import React from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function InvoiceLoading() {
  return (
    <div>
      <DashboardHeader
        title={<Skeleton className="h-8 w-48" />}
        className="pb-4"
        headerActions={
          <div className="flex gap-2">
            <Skeleton className="h-10 w-10 md:h-10 md:w-20" />
            <Skeleton className="hidden h-10 w-24 md:block" />
          </div>
        }
      />
      <div className="space-y-4">
        {/* Status section */}
        <div className="mx-4">
          <Skeleton className="mb-2 h-4 w-16" />
          <Skeleton className="h-5 w-40" />
        </div>

        {/* Invoice details section */}
        <section className="mx-4">
          <div className="grid gap-4 pb-28">
            <div className="grid auto-cols-fr gap-3 p-4 md:grid-flow-col">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="mb-2 h-4 w-20" />
                  <Skeleton className="h-5 w-32" />
                </div>
              ))}
            </div>

            {/* Invoice items list table */}
            <div className="w-full overflow-x-auto">
              <Table className="w-full min-w-fit">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%] md:w-[50%]">
                      <Skeleton className="h-4 w-24" />
                    </TableHead>
                    <TableHead className="w-[20%] text-right md:w-[15%]">
                      <Skeleton className="ml-auto h-4 w-20" />
                    </TableHead>
                    <TableHead className="w-[20%] text-right md:w-[15%]">
                      <Skeleton className="ml-auto h-4 w-20" />
                    </TableHead>
                    <TableHead className="w-[20%] text-right">
                      <Skeleton className="ml-auto h-4 w-20" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="w-[50%] align-top md:w-[60%]">
                        <Skeleton className="h-4 w-full max-w-md" />
                      </TableCell>
                      <TableCell className="w-[20%] text-right align-top md:w-[15%]">
                        <Skeleton className="ml-auto h-4 w-16" />
                      </TableCell>
                      <TableCell className="w-[20%] text-right align-top md:w-[15%]">
                        <Skeleton className="ml-auto h-4 w-20" />
                      </TableCell>
                      <TableCell className="w-[10%] text-right align-top">
                        <Skeleton className="ml-auto h-4 w-20" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Footer with totals */}
            <footer className="flex flex-col justify-between gap-3 px-4 lg:flex-row">
              <div className="flex-1">
                <Skeleton className="mb-2 h-5 w-16" />
                <Skeleton className="h-16 w-full max-w-md" />
              </div>
              <Card className="self-start">
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between gap-8">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <Separator />
                    <div className="flex justify-between gap-8">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </footer>
          </div>
        </section>
      </div>
    </div>
  );
}
