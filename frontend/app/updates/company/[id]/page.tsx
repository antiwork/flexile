"use client";
import { EnvelopeIcon } from "@heroicons/react/24/outline";
import { useParams } from "next/navigation";
import React from "react";
import FinancialOverview from "@/app/updates/company/FinancialOverview";
import MainLayout from "@/app/components/main-layout";
import MutationButton from "@/components/MutationButton";
import RichText from "@/components/RichText";
import { useCurrentCompany } from "@/global";
import { trpc } from "@/trpc/client";

function View() {
  const company = useCurrentCompany();
  const { id } = useParams<{ id: string }>();
  const [update] = trpc.companyUpdates.get.useSuspenseQuery({ companyId: company.id, id });

  const sendTestEmail = trpc.companyUpdates.sendTestEmail.useMutation();

  const youtubeId = update.videoUrl && /(?:youtube\.com.*[?&]v=|youtu\.be\/)([\w-]+)/u.exec(update.videoUrl)?.[1];

  return (
    <MainLayout
      title={`${update.sentAt ? "" : "Previewing:"} ${update.title}`}
      headerActions={
        !update.sentAt && (
          <MutationButton loadingText="Sending..." mutation={sendTestEmail} param={{ companyId: company.id, id }}>
            <EnvelopeIcon className="size-4" />
            Send test email
          </MutationButton>
        )
      }
    >
      {(update.showRevenue || update.showNetIncome) && update.period && update.periodStartedOn ? (
        <FinancialOverview
          financialReports={update.financialReports}
          period={update.period}
          periodStartedOn={update.periodStartedOn}
        />
      ) : null}

      <RichText content={update.body} />

      {youtubeId ? (
        <div className="aspect-video">
          {/* eslint-disable-next-line -- can't use sandbox for youtube embeds */}
          <iframe
            className="size-full"
            width="560"
            height="315"
            src={`https://www.youtube.com/embed/${youtubeId}?controls=0&rel=0`}
            title="YouTube video player"
            allow="clipboard-write; encrypted-media; picture-in-picture;"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      ) : update.videoUrl ? (
        <a href={update.videoUrl} target="_blank" rel="noreferrer">
          Watch the video
        </a>
      ) : null}

      <p>{company.primaryAdminName}</p>
    </MainLayout>
  );
}

export default View;
