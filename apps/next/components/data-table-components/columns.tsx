"use client";

import React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Expense } from "./schema";
import { DataTableColumnHeader } from "./data-table-column-header";
import { LinkIcon } from "lucide-react";
import { PayRateType } from "@/db/enums";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import CopyButton from "@/components/CopyButton";
import { Button } from "../ui/button";



export const columns: ColumnDef<Expense>[] =
  [
    {
      accessorKey: "role",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Role" />
      ),
      cell: ({ row }) => (
        <div className="w-[150px]  text-base capitalize">{row.getValue("role")}</div>
      ),

    },
    {
      accessorFn: (row) => row.payRateInSubunits, // keep real data key
      id: "rate",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Rate" />
      ),
      filterFn: (row, columnId, filterValue: [number, number]) => {

        const value = row.getValue(columnId) as number;
        if (!filterValue) return true;
        const [min, max] = filterValue;

        return value >= min * 100 && value <= max * 100;
      },
      cell: ({ row }) => {
        const amount = row.getValue("rate") as number;
        const isHourly = row.original.payRateType === PayRateType.Hourly;
        return isHourly
          ? <div className="text-base">
            ${(amount / 100)} / Hour

          </div>

          : <div className="text-base">
            ${(amount / 100)} / Project
          </div>
      }
    },
    {
      accessorFn: (row) => row.applicationCount, // keep real data key
      id: "candidates",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Candidate" />
      ),
      cell: ({ row }) => {
        return (
          <div className="flex w-[100px] items-center">
            <span className="capitalize text-base"> {row.getValue("candidates")}</span>
          </div>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      }
    },


    {
      accessorFn: (row) => row.activelyHiring, // keep real data key
      id: "stauts",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const isActive = row.getValue("stauts") as boolean;
        const [isHiring, setIsHiring] = React.useState(isActive);

        return (
          <div className="flex items-center space-x-2">
            <Switch
              id={`active-hiring-${row.id}`}
              checked={isHiring}
              onCheckedChange={(checked) => {
                setIsHiring(checked);
                // You can add your update logic here (e.g., API call)
                console.log(`Updated hiring status for ${row.original.name} to ${checked}`);
              }}
            />
            <Label htmlFor={`active-hiring-${row.id}`}>
              {isHiring ? "Hiring" : "Closed"}
            </Label>
          </div>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      }
    },

    {
      id: "copy",
      cell: ({ row }) => {

        const getRolesUrl = () => new URL(window.location.origin).toString();
        return (
          <div className="flex w-[100px] items-center">
            <CopyButton variant="outline" copyText={getRolesUrl()}>
              <LinkIcon className="size-4" /> Copy link
            </CopyButton>
          </div>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      }
    },
    {
      id: "edit",
      cell: ({ row }) => {
        return (
          <div className="flex w-[100px] items-center">
            <Button
              variant="outline"
              className="flex items-center space-x-1 rounded-full  text-gray-700 hover:text-blue-500 hover:border-blue-500 transition-all duration-300 ease-in-out  group"
            >
              <LinkIcon className="size-4 group-hover:text-blue-600 transition-colors duration-300" />
              <span>Edit</span>
            </Button>

          </div>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      }
    },
    // {
    //   id: "actions",
    //   cell: ({ row }) => <DataTableRowActions row={row} />
    // }
  ];