"use client";
import { CircleCheck, Plus } from "lucide-react";
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
import Status from "@/components/Status";
import { getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import { isFuture, isPast } from "date-fns";
import { utc } from "@date-fns/utc";
import { useMutation } from "@tanstack/react-query";
import { md5Checksum } from "@/utils";

type ActiveModal = "buyback-details" | "letter-of-transmittal" | "select-investors" | null;

interface BuybackData {
  buybackType: "single" | "tender";
  name: string;
  startDate: Date;
  endDate: Date;
  startingValuation: number;
  targetBuybackValue: number;
  attachment: File;
}

interface LetterData {
  content: string;
}

export default function Buybacks() {
  const company = useCurrentCompany();
  const router = useRouter();
  const user = useCurrentUser();
  const [data, { refetch }] = trpc.tenderOffers.list.useSuspenseQuery({ companyId: company.id });
  const [selectedTenderOffer, setSelectedTenderOffer] = useState<(typeof data)[number] | null>(null);

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  const [buybackData, setBuybackData] = useState<BuybackData | null>(null);
  const [letterData, setLetterData] = useState<LetterData | null>(null);
  const [investorsData, setInvestorsData] = useState<string[]>([]);

  const createUploadUrl = trpc.files.createDirectUploadUrl.useMutation();
  const createTenderOffer = trpc.tenderOffers.create.useMutation();

  const columnHelper = createColumnHelper<(typeof data)[number]>();
  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "name",
        header: "Name",
        cell: (info) => {
          const content = "";
          return (
            <Link href={`/equity/tender_offers/${info.row.original.id}`} className="after:absolute after:inset-0">
              {content}
            </Link>
          );
        },
      }),
      columnHelper.simple("endsAt", "End date", formatDate),
      columnHelper.simple("minimumValuation", "Starting valuation", formatMoney),
      columnHelper.display({
        id: "impliedValuation",
        header: "Implied valuation",
        cell: (info) =>
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
          return participation > 0 ? formatMoneyFromCents(participation) : "—";
        },
      }),
      columnHelper.accessor("bidCount", {
        header: "Your bids",
        cell: (info) => info.getValue(),
      }),

      columnHelper.accessor((row) => (row.endsAt > new Date() ? "Settled" : "Open"), {
        header: "Status",
        meta: { filterOptions: ["Open", "Settled"] },
        cell: (info) =>
          info.row.original.endsAt > new Date() ? (
            <Status variant="success">{info.getValue()}</Status>
          ) : (
            <Status variant="primary">{info.getValue()}</Status>
          ),
      }),

      columnHelper.display({
        id: "actions",
        cell: (info) =>
          isPast(utc(info.row.original.startsAt)) && isFuture(utc(info.row.original.endsAt)) ? (
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
          ) : null,
      }),
    ],
    [company.fullyDilutedShares],
  );

  const table = useTable({
    columns,
    data,
    initialState: {
      sorting: [{ id: "Status", desc: false }],
    },
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const handleBuybackDetailsNext = (data: BuybackData) => {
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

  const handleFlowCancel = () => {
    resetFlow();
  };

  const createBuybackMutation = useMutation({
    mutationFn: async () => {
      if (!buybackData) {
        throw new Error("Buyback data is required");
      }

      const { attachment, startDate, endDate, startingValuation } = buybackData;

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

      await createTenderOffer.mutateAsync({
        companyId: company.id,
        startsAt: startDate,
        endsAt: endDate,
        minimumValuation: BigInt(startingValuation),
        attachmentKey: key,
      });

      // TODO Save letter content and selected investors
      console.log("Letter data:", letterData);
      console.log("Selected investors:", investorsData);
    },
    onSuccess: () => {
      resetFlow();
      void refetch();
    },
  });

  return (
    <EquityLayout
      headerActions={
        user.roles.administrator ? (
          <Button size="small" variant="outline" onClick={() => setActiveModal("buyback-details")}>
            <Plus className="size-4" />
            New buyback
          </Button>
        ) : null
      }
    >
      {data.length ? (
        <DataTable
          searchColumn={user.roles.administrator ? "name" : undefined}
          table={table}
          onRowClicked={(row) => router.push(`/equity/tender_offers/${row.id}`)}
        />
      ) : (
        <Placeholder icon={CircleCheck}>There are no buybacks yet.</Placeholder>
      )}

      <PlaceBidModal
        isOpen={!!selectedTenderOffer}
        onClose={() => setSelectedTenderOffer(null)}
        tenderOffer={selectedTenderOffer}
      />

      <NewBuybackModal
        isOpen={activeModal === "buyback-details"}
        onClose={handleFlowCancel}
        onNext={handleBuybackDetailsNext}
      />

      <CreateLetterOfTransmittalModal
        isOpen={activeModal === "letter-of-transmittal"}
        onClose={handleFlowCancel}
        onNext={handleLetterNext}
        onBack={handleLetterBack}
        data={letterData}
      />

      <SelectInvestorsModal
        isOpen={activeModal === "select-investors"}
        onClose={handleFlowCancel}
        onBack={handleInvestorsBack}
        onNext={handleInvestorsNext}
        mutation={createBuybackMutation}
        data={investorsData}
      />
    </EquityLayout>
  );
}
