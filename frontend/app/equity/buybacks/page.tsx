"use client";
import { utc } from "@date-fns/utc";
import { getLocalTimeZone } from "@internationalized/date";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import { isFuture, isPast } from "date-fns";
import { Circle, CircleCheck, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import { z } from "zod";
import { type Buyback, buybackSchema, createBuybackSchema } from "@/app/equity/buybacks";
import CreateLetterOfTransmittalModal from "@/app/equity/buybacks/CreateLetterOfTransmittalModal";
import NewBuybackModal from "@/app/equity/buybacks/NewBuybackModal";
import PlaceBidModal from "@/app/equity/buybacks/PlaceBidModal";
import SelectInvestorsModal from "@/app/equity/buybacks/SelectInvestorsModal";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Placeholder from "@/components/Placeholder";
import { Button } from "@/components/ui/button";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { trpc } from "@/trpc/client";
import { md5Checksum } from "@/utils";
import { formatMoney, formatMoneyFromCents } from "@/utils/formatMoney";
import { request } from "@/utils/request";
import { company_tender_offers_path } from "@/utils/routes";
import { formatDate } from "@/utils/time";
import EquityLayout from "../Layout";

type ActiveModal = "buyback-details" | "letter-of-transmittal" | "select-investors" | null;

export default function Buybacks() {
  const company = useCurrentCompany();
  const router = useRouter();
  const user = useCurrentUser();

  const { data, refetch } = useSuspenseQuery({
    queryKey: ["buybacks", company.id],
    queryFn: async () => {
      const response = await request({
        accept: "json",
        method: "GET",
        url: company_tender_offers_path(company.id),
        assertOk: true,
      });
      return z
        .object({
          buybacks: z.array(buybackSchema),
        })
        .parse(await response.json());
    },
  });

  const [selectedBuyback, setSelectedBuyback] = useState<Buyback | null>(null);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [buybackData, setBuybackData] = useState<Omit<
    z.infer<typeof createBuybackSchema>,
    "investors" | "letter_of_transmittal"
  > | null>(null);
  const [letterData, setLetterData] = useState<z.infer<typeof createBuybackSchema>["letter_of_transmittal"] | null>(
    null,
  );
  const [investorsData, setInvestorsData] = useState<z.infer<typeof createBuybackSchema>["investors"] | null>(null);

  const createUploadUrl = trpc.files.createDirectUploadUrl.useMutation();

  const columnHelper = createColumnHelper<Buyback>();
  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "name",
        header: "Name",
        cell: (info) => {
          const content = info.row.original.name;
          return (
            <Link href={`/equity/buybacks/${info.row.original.id}`} className="after:absolute after:inset-0">
              {content}
            </Link>
          );
        },
      }),
      columnHelper.simple("ends_at", "End date", formatDate),
      columnHelper.simple("minimum_valuation", "Starting valuation", formatMoney),
      columnHelper.display({
        id: "implied_valuation",
        header: "Implied valuation",
        cell: () =>
          // TODO: Need to store fullyDilutedShares at tender offer creation time
          // Using current fullyDilutedShares gives incorrect historical valuations
          // See backend TODO in company_investor_mailer/tender_offer_closed.html.erb
          "—",
      }),
      columnHelper.display({
        id: "participation",
        header: "Participation",
        cell: (info) => {
          const { participation } = info.row.original;
          if (!participation) return "—";
          return formatMoney(participation);
        },
      }),
      user.roles.administrator
        ? columnHelper.accessor("investor_count", {
            header: "Investors",
            cell: (info) => info.getValue(),
          })
        : columnHelper.accessor("bid_count", {
            header: "Your bids",
            cell: (info) => info.getValue(),
          }),
      columnHelper.accessor(
        (row) =>
          row.equity_buyback_round_count
            ? "Settled"
            : isFuture(utc(row.ends_at))
              ? "Open"
              : user.roles.administrator
                ? "Closed"
                : "Reviewing",
        {
          id: "status",
          header: "Status",
          meta: { filterOptions: ["Open", "Settled", "Reviewing"] },
          cell: (info) =>
            info.getValue() === "Open" ? (
              <span className="inline-flex items-center gap-2">
                <Circle className="fill-green text-green h-4 w-4" />
                {info.getValue()}
              </span>
            ) : ["Reviewing", "Closed"].includes(info.getValue()) ? (
              <span className="inline-flex items-center gap-2">
                <Circle className="h-4 w-4 fill-gray-300 text-gray-300" />
                {info.getValue()}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Circle className="h-4 w-4 fill-blue-600 text-blue-600" />
                {info.getValue()}
              </span>
            ),
        },
      ),

      columnHelper.display({
        id: "actions",
        cell: (info) => (
          <>
            {info.row.original.open ? (
              <Button
                size="small"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedBuyback(info.row.original);
                }}
              >
                Place bid
              </Button>
            ) : null}
            {user.roles.administrator && isPast(utc(info.row.original.ends_at)) ? (
              <Button
                size="small"
                className="fill-black"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/equity/buybacks/${info.row.original.id}`);
                }}
              >
                Review
              </Button>
            ) : null}
          </>
        ),
      }),
    ],
    [company.fullyDilutedShares],
  );

  const table = useTable({
    columns,
    data: data.buybacks,
    getSortedRowModel: getSortedRowModel(),
    ...(user.roles.administrator && { getFilteredRowModel: getFilteredRowModel() }),
  });

  const handleInvestorsBack = () => {
    setActiveModal("letter-of-transmittal");
  };

  const resetFlow = () => {
    setActiveModal(null);
    setBuybackData(null);
    setLetterData(null);
    setInvestorsData([]);
  };

  const createBuybackMutation = useMutation({
    mutationFn: async () => {
      if (!buybackData) {
        throw new Error("Buyback data is required");
      }

      const { attachment, ...jsonData } = buybackData;

      if (attachment) {
        const base64Checksum = await md5Checksum(attachment);
        const { directUploadUrl, key } = await createUploadUrl.mutateAsync({
          isPublic: false,
          filename: attachment.name,
          byteSize: attachment.size,
          checksum: base64Checksum,
          contentType: attachment.type,
        });

        await fetch(directUploadUrl, {
          method: "PUT",
          body: attachment,
          headers: {
            "Content-Type": attachment.type,
            "Content-MD5": base64Checksum,
          },
        });
        jsonData.attachment_key = key;
      }

      await request({
        method: "POST",
        url: company_tender_offers_path(company.id),
        accept: "json",
        jsonData: createBuybackSchema.parse({
          ...jsonData,
          letter_of_transmittal: letterData,
          investors: investorsData,
        }),
        assertOk: true,
      });
    },
    onSuccess: () => {
      resetFlow();
      void refetch();
    },
  });

  return (
    <EquityLayout
      headerActions={
        user.roles.administrator && !data.buybacks.length ? (
          <Button size="small" variant="outline" onClick={() => setActiveModal("buyback-details")}>
            <Plus className="size-4" />
            New buyback
          </Button>
        ) : null
      }
    >
      {data.buybacks.length ? (
        <DataTable
          searchColumn={user.roles.administrator ? "name" : undefined}
          table={table}
          onRowClicked={(row) => router.push(`/equity/buybacks/${row.id}`)}
          actions={
            user.roles.administrator ? (
              <Button size="small" variant="outline" onClick={() => setActiveModal("buyback-details")}>
                <Plus className="size-4" />
                New buyback
              </Button>
            ) : null
          }
        />
      ) : (
        <Placeholder icon={CircleCheck}>There are no buybacks yet.</Placeholder>
      )}

      <PlaceBidModal isOpen={!!selectedBuyback} onClose={() => setSelectedBuyback(null)} buyback={selectedBuyback} />

      <NewBuybackModal
        isOpen={activeModal === "buyback-details"}
        onClose={resetFlow}
        onNext={({ start_date, end_date, total_amount, starting_price, ...data }) => {
          setBuybackData({
            ...data,
            starts_at: start_date.toDate(getLocalTimeZone()),
            ends_at: end_date.toDate(getLocalTimeZone()),
            total_amount_in_cents: total_amount * 100,
            starting_price_per_share_cents: starting_price * 100,
          });
          setActiveModal("letter-of-transmittal");
        }}
      />

      <CreateLetterOfTransmittalModal
        isOpen={activeModal === "letter-of-transmittal"}
        onClose={resetFlow}
        onNext={(data) => {
          setLetterData(data);
          setActiveModal("select-investors");
        }}
        onBack={() => {
          setActiveModal("buyback-details");
        }}
      />

      <SelectInvestorsModal
        isOpen={activeModal === "select-investors"}
        onClose={resetFlow}
        onBack={handleInvestorsBack}
        onNext={(data) => {
          setInvestorsData(data);
          setActiveModal("select-investors");
          createBuybackMutation.mutate();
        }}
        mutation={createBuybackMutation}
      />
    </EquityLayout>
  );
}
