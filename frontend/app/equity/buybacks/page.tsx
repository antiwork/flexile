"use client";
import { Circle, CircleCheck, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import DataTable, { createColumnHelper, useTable } from "@/components/DataTable";
import Placeholder from "@/components/Placeholder";
import PlaceBidModal from "@/app/equity/tender_offers/PlaceBidModal";
import NewBuybackModal from "@/app/equity/tender_offers/NewBuybackModal";
import CreateLetterOfTransmittalModal from "@/app/equity/tender_offers/CreateLetterOfTransmittalModal";
import SelectInvestorsModal from "@/app/equity/tender_offers/SelectInvestorsModal";
import { Button } from "@/components/ui/button";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { trpc } from "@/trpc/client";
import { formatMoney, formatMoneyFromCents } from "@/utils/formatMoney";
import { formatDate } from "@/utils/time";
import EquityLayout from "../Layout";
import { getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import { isFuture, isPast } from "date-fns";
import { utc } from "@date-fns/utc";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { md5Checksum } from "@/utils";
import { CalendarDate, getLocalTimeZone } from "@internationalized/date";
import { request } from "@/utils/request";
import { company_tender_offers_path } from "@/utils/routes";
import { z } from "zod";

type ActiveModal = "buyback-details" | "letter-of-transmittal" | "select-investors" | null;

interface LetterData {
  content: string;
}

const buybackSchema = z.object({
  id: z.string(),
  name: z.string(),
  buyback_type: z.enum(["single", "tender"]),
  starts_at: z.instanceof(Date),
  ends_at: z.instanceof(Date),
  minimum_valuation: z.number(),
  implied_valuation: z.number().nullable(),
  total_amount_in_cents: z.number(),
  accepted_price_cents: z.number().nullable(),
  participation: z.number().nullable(),
  bid_count: z.number().nullable(),
  investor_count: z.number().nullable(),
  open: z.boolean(),
});

const createBuybackSchema = buybackSchema
  .pick({ name: true, starts_at: true, ends_at: true, minimum_valuation: true })
  .extend({ starting_price_per_share_cents: z.number(), attachment: z.instanceof(File) });

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

  const [selectedTenderOffer, setSelectedTenderOffer] = useState<z.infer<typeof buybackSchema> | null>(null);

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  const [buybackData, setBuybackData] = useState<z.infer<typeof createBuybackSchema> | null>(null);
  const [letterData, setLetterData] = useState<LetterData | null>(null);
  const [investorsData, setInvestorsData] = useState<string[]>([]);

  const createUploadUrl = trpc.files.createDirectUploadUrl.useMutation();

  const columnHelper = createColumnHelper<z.infer<typeof buybackSchema>>();
  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "name",
        header: "Name",
        cell: (info) => {
          const content = info.row.original.name;
          return (
            <Link href={`/equity/tender_offers/${info.row.original.id}`} className="after:absolute after:inset-0">
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
          "-",
      }),
      columnHelper.display({
        id: "participation",
        header: "Participation",
        cell: (info) => {
          const { participation } = info.row.original;
          if (!participation) return "—";
          return formatMoneyFromCents(participation);
        },
      }),
      columnHelper.accessor("bid_count", {
        header: user.roles.administrator ? "Investors" : "Your bids",
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor(
        (row) =>
          row.accepted_price_cents // TODO
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
                  setSelectedTenderOffer(info.row.original);
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
                  router.push(`/equity/tender_offers/${info.row.original.id}`);
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

  const handleBuybackDetailsNext = (data: z.infer<typeof createBuybackSchema>) => {
    setBuybackData(data);
    setActiveModal("letter-of-transmittal");
  };

  const handleLetterNext = (data: LetterData) => {
    setLetterData(data);
    setActiveModal("select-investors");
  };

  const handleLetterBack = () => {
    setActiveModal("buyback-details");
  };

  const handleInvestorsBack = () => {
    setActiveModal("letter-of-transmittal");
  };

  const handleInvestorsNext = (data: string[]) => {
    setInvestorsData(data);
    setActiveModal("select-investors");
    createBuybackMutation.mutate();
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

      const { attachment } = buybackData;

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

      await request({
        method: "POST",
        url: company_tender_offers_path(company.id),
        accept: "json",
        jsonData: createBuybackSchema.parse({
          ...buybackData,
          ...letterData,
          ...investorsData,
          attachmentKey: key,
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
          onRowClicked={(row) => router.push(`/equity/tender_offers/${row.id}`)}
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

      <PlaceBidModal
        isOpen={!!selectedTenderOffer}
        onClose={() => setSelectedTenderOffer(null)}
        // fetch single tender offer data
        tenderOffer={selectedTenderOffer}
      />

      <NewBuybackModal
        isOpen={activeModal === "buyback-details"}
        onClose={resetFlow}
        onNext={handleBuybackDetailsNext}
      />

      <CreateLetterOfTransmittalModal
        isOpen={activeModal === "letter-of-transmittal"}
        onClose={resetFlow}
        onNext={handleLetterNext}
        onBack={handleLetterBack}
        data={letterData}
      />

      <SelectInvestorsModal
        isOpen={activeModal === "select-investors"}
        onClose={resetFlow}
        onBack={handleInvestorsBack}
        onNext={handleInvestorsNext}
        mutation={createBuybackMutation}
        data={investorsData}
      />
    </EquityLayout>
  );
}
