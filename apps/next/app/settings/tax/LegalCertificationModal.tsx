"use client";

import { ArrowTopRightOnSquareIcon } from "@heroicons/react/16/solid";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import React, { useState, useEffect } from "react";
import Input from "@/components/Input";
import { linkClasses } from "@/components/Link";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MutationButton from "@/components/MutationButton";

const LegalCertificationModal = ({
  open,
  legalName,
  isForeignUser,
  isBusiness,
  sticky,
  onClose,
  mutation,
}: {
  open: boolean;
  legalName: string;
  isForeignUser: boolean;
  isBusiness: boolean;
  sticky?: boolean;
  onClose: () => void;
  mutation: UseMutationResult<unknown, unknown, string>;
}) => {
  const [signature, setSignature] = useState(legalName);
  
  useEffect(() => {
    setSignature(legalName);
  }, [legalName]);
  const certificateType = isForeignUser ? (isBusiness ? "W-8BEN-E" : "W-8BEN") : "W-9";
  const foreignEntityTitle = isBusiness ? "entity" : "individual";
  const signMutation = useMutation({
    mutationFn: async () => {
      await mutation.mutateAsync(signature);
      onClose();
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={() => {
        if (!sticky) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{certificateType} Certification and Tax Forms Delivery</DialogTitle>
        </DialogHeader>
        {isForeignUser ? (
          <>
            <div>
              The provided information will be included in the {certificateType} form required by the U.S. tax laws to
              confirm your taxpayer status. If you're eligible for 1042-S forms, you'll receive an email with a download
              link once available.
            </div>
            <div className="flex gap-1">
              <ArrowTopRightOnSquareIcon className="size-4" />
              <a
                target="_blank"
                rel="noopener noreferrer nofollow"
                href={`https://www.irs.gov/forms-pubs/about-form-${certificateType.toLowerCase()}`}
                className={linkClasses}
              >
                Official {certificateType} instructions
              </a>
            </div>
          </>
        ) : (
          <>
            <div>
              The information you provided will be included in the W-9 form required by the U.S. tax laws to confirm
              your taxpayer status. If you're eligible for 1099 forms, you'll receive an email with a download link once
              available.
            </div>
            <div className="flex gap-1">
              <ArrowTopRightOnSquareIcon className="size-4" />
              <a
                target="_blank"
                rel="noopener noreferrer nofollow"
                href="https://www.irs.gov/forms-pubs/about-form-w-9"
                className={linkClasses}
              >
                Official W-9 instructions
              </a>
            </div>
          </>
        )}

        <div className="prose h-[25em] overflow-y-auto rounded-md border p-4">
          <b>{certificateType} Certification</b>
          <br />
          <br />
          {isForeignUser ? (
            <>
              Under penalties of perjury, I declare that I have examined the information on this form and to the best of
              my knowledge and belief it is true, correct, and complete. I further certify under penalties of perjury
              that:
              <br />
              <br />
              {isBusiness
                ? "• The entity identified on line 1 of this form is the beneficial owner of all the income or proceeds to which this form relates, is using this form to certify its status for chapter 4 purposes, or is submitting this form for purposes of section 6050W or 6050Y;"
                : "• I am the individual that is the beneficial owner (or am authorized to sign for the individual that is the beneficial owner) of all the income or proceeds to which this form relates or am using this form to document myself for chapter 4 purposes;"}
              <br />
              <br />• The {foreignEntityTitle} named on line 1 of this form is not a U.S. person; <br />
              <br />
              • This form relates to:
              <br />
              <br />
              (a) income not effectively connected with the conduct of a trade or business in the United States;
              <br />
              (b) income effectively connected with the conduct of a trade or business in the United States but is not
              subject to tax under an applicable income tax treaty;
              <br />
              (c) the partner's share of a partnership's effectively connected taxable income; or
              <br />
              (d) the partner's amount realized from the transfer of a partnership interest subject to withholding under
              section 1446(f);
              <br />
              <br />• The {foreignEntityTitle} named on line 1 of this form is a resident of the treaty Country of
              residence listed on line 9 of the form (if any) within the meaning of the income tax treaty between the
              United States and that Country of residence; and <br />
              <br />
              • For broker transactions or barter exchanges, the beneficial owner is an exempt foreign person as defined
              in the instructions.
              <br />
              <br />
              Furthermore, I authorize this form to be provided to any withholding agent that has control, receipt, or
              custody of the income of which the {foreignEntityTitle} named on line 1 or any withholding agent that can
              disburse or make payments of the income of which the {foreignEntityTitle} named on line 1. <br />
              <br />I agree that I will submit a new form within 30 days if any certification made on this form becomes
              incorrect.
            </>
          ) : (
            <>
              Under penalties of perjury, I certify that:
              <br />
              <br />
              <ol>
                <li>
                  The number shown on this form is my correct taxpayer identification number (or I am waiting for a
                  number to be issued to me); and
                </li>
                <li>
                  I am not subject to backup withholding because: (a) I am exempt from backup withholding, or (b) I have
                  not been notified by the Internal Revenue Service (IRS) that I am subject to backup withholding as a
                  result of a failure to report all interest or dividends, or (c) the IRS has notified me that I am no
                  longer subject to backup withholding; and
                </li>
                <li>I am a U.S. citizen or other U.S. person (defined below); and</li>
                <li>
                  The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is
                  correct
                </li>
              </ol>
            </>
          )}
          <br />
          <br />
          <b>Consent for Electronic Delivery of Tax Forms</b>
          <br />
          <br />
          By consenting to receive tax forms electronically, you agree to the following terms:
          <br />
          <br />
          <ol>
            <li>Your consent applies to all tax documents during your time using Flexile services.</li>
            <li>
              You can withdraw this consent or request paper copies anytime by contacting{" "}
              <a href="mailto:support@flexile.com" className={linkClasses}>
                support@flexile.com
              </a>
              .
            </li>
            <li>
              To access your tax forms, you'll need internet, an email account, your Flexile password, and PDF-viewing
              software.
            </li>
            <li>Your tax forms will be available for download for at least one year.</li>
            <li>
              If you don't consent to electronic delivery, contact us at{" "}
              <a href="mailto:support@flexile.com" className={linkClasses}>
                support@flexile.com
              </a>{" "}
              to arrange postal delivery.
            </li>
          </ol>
        </div>

        <Input
          value={signature}
          onChange={setSignature}
          label="Your signature"
          className="font-signature text-xl"
          aria-label="Signature"
          help="I agree that the signature will be the electronic representation of my signature and for all purposes when I use them on documents just the same as a pen-and-paper signature."
        />

        <DialogFooter>
          <MutationButton mutation={signMutation} loadingText="Saving..." disabled={!signature}>
            Save
          </MutationButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LegalCertificationModal;
