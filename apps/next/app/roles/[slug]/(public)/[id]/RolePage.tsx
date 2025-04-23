"use client";

import { LinkIcon } from "@heroicons/react/16/solid";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { useMutation } from "@tanstack/react-query";
import { Set } from "immutable";
import Image from "next/image";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import Input from "@/components/Input";
import SimpleLayout from "@/components/layouts/Simple";
import MutationButton from "@/components/MutationButton";
import RangeInput from "@/components/RangeInput";
import RichText, { Editor as RichTextEditor } from "@/components/RichText";
import Select from "@/components/Select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_WORKING_HOURS_PER_WEEK, MAX_WORKING_HOURS_PER_WEEK, WORKING_WEEKS_PER_YEAR } from "@/models";
import { countryInfos } from "@/models/constants";
import { PayRateType, trpc } from "@/trpc/client";
import { toSlug } from "@/utils";
import { formatMoneyFromCents } from "@/utils/formatMoney";

export default function RolePage({ countryCode }: { countryCode: string }) {
  const { slug: companySlug, id: roleSlug } = useParams<{ slug: string; id: string }>();
  const [_, roleId] = roleSlug.split(/-(?=[^-]*$)/u);
  if (!roleId) notFound();

  const [role] = trpc.roles.public.get.useSuspenseQuery({ id: roleId });
  const [company] = trpc.companies.publicInfo.useSuspenseQuery({ companyId: role.companyId });
  const companyStats = "stats" in company ? company.stats : undefined;
  const [roles] = trpc.roles.public.list.useSuspenseQuery({ companyId: role.companyId });
  const otherRoles = roles.filter((r) => r.id !== roleId);

  const [values, setValues] = useState({
    name: "",
    email: "",
    description: "",
    countryCode,
    hoursPerWeek: companyStats?.avgHoursPerWeek
      ? Math.round(companyStats.avgHoursPerWeek)
      : DEFAULT_WORKING_HOURS_PER_WEEK,
    weeksPerYear: companyStats?.avgWeeksPerYear ? Math.round(companyStats.avgWeeksPerYear) : WORKING_WEEKS_PER_YEAR,
  });
  const [step, setStep] = useQueryState(
    "step",
    parseAsStringLiteral(["initial", "applying", "sent"]).withDefault("initial"),
  );
  const [errors, setErrors] = useState(Set<string>());
  Object.entries(values).forEach(([key, value]) => useEffect(() => setErrors(errors.delete(key)), [value]));
  const updateValues = (updated: Partial<typeof values>) => setValues((prev) => ({ ...prev, ...updated }));

  const createApplication = trpc.roles.applications.create.useMutation();
  const submitMutation = useMutation({
    mutationFn: async () => {
      const newErrors = errors.clear().withMutations((errors) =>
        Object.entries(values).forEach(([key, value]) => {
          if (!value) errors.add(key);
        }),
      );

      if (newErrors.size > 0) {
        setErrors(newErrors);
        return;
      }

      await createApplication.mutateAsync({
        companyRoleId: roleId,
        ...values,
        equityPercent: 0,
      });

      await setStep("sent");
    },
  });

  if (step === "sent") {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <CheckCircleIcon className="size-20" />
        <h1 className="text-3xl font-bold">We received your application</h1>
        <span>You'll hear from {company.name} soon if there's a potential fit.</span>
      </div>
    );
  }

  return (
    <SimpleLayout
      hideHeader
      title={
        <div className="flex flex-col items-center gap-4">
          <Image src={company.logoUrl ?? ""} className="size-12 justify-self-center rounded-md" alt="" />
          <div>
            {role.name} at {company.name}
          </div>
        </div>
      }
    >
      <title>{`${role.name} at ${company.name}`}</title>
      {step === "initial" ? (
        <>
          {company.website ? (
            <a href={company.website} className="justify-self-center">
              <LinkIcon className="inline size-4" />
              {company.website}
            </a>
          ) : null}
          {role.jobDescription ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">The role</CardTitle>
              </CardHeader>
              <CardContent>
                <RichText content={role.jobDescription} />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">About {company.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <RichText content={company.description} />
            </CardContent>
          </Card>

          {companyStats ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Our team</CardTitle>
              </CardHeader>
              <CardContent className="prose">
                <ul>
                  {companyStats.freelancers ? (
                    <li>{companyStats.freelancers.toLocaleString()} part-time freelancers</li>
                  ) : null}
                  {companyStats.avgHoursPerWeek && companyStats.avgWeeksPerYear ? (
                    <li>
                      Average {Math.round(companyStats.avgHoursPerWeek)} hours / week,{" "}
                      {Math.round(companyStats.avgWeeksPerYear)} weeks / year
                    </li>
                  ) : null}
                  {companyStats.avgTenure ? <li>Average tenure of {companyStats.avgTenure.toFixed(2)} years</li> : null}
                  {companyStats.attritionRate ? (
                    <li>
                      {(companyStats.attritionRate / 100).toLocaleString(undefined, { style: "percent" })} annual
                      contractor "churn" rate
                    </li>
                  ) : null}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            {role.payRateType === PayRateType.Hourly ? (
              <>
                <CardHeader>
                  <CardTitle className="text-xl">Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  {formatMoneyFromCents(role.payRateInSubunits)} / hour
                  {company.equityGrantsEnabled ? (
                    <p className="text-gray-500">
                      Part of this rate will be in the form of equity. This selection will be made during onboarding.
                    </p>
                  ) : null}
                </CardContent>
              </>
            ) : role.payRateType === PayRateType.Salary ? (
              <>
                <CardHeader>
                  <CardTitle className="text-xl">Salary</CardTitle>
                </CardHeader>
                <CardContent>
                  {formatMoneyFromCents(role.payRateInSubunits)} / year
                  {company.equityGrantsEnabled ? (
                    <p className="text-gray-500">
                      Part of your salary will be in the form of equity. This selection will be made during onboarding.
                    </p>
                  ) : null}
                </CardContent>
              </>
            ) : (
              <>
                <CardHeader>
                  <CardTitle className="text-xl">Salary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{formatMoneyFromCents(role.payRateInSubunits)}</div>
                  <p className="text-gray-500">Rate per project</p>
                  {company.equityGrantsEnabled ? (
                    <p className="text-gray-500">
                      Part of this rate will be given in equity. This selection will be made during onboarding.
                    </p>
                  ) : null}
                </CardContent>
              </>
            )}
          </Card>

          {role.trialEnabled ? (
            <Alert variant="destructive">
              <ExclamationTriangleIcon />
              <AlertDescription>
                This role has a trial period with a rate of {formatMoneyFromCents(role.trialPayRateInSubunits)} / hour.
              </AlertDescription>
            </Alert>
          ) : null}

          <Button disabled={!role.activelyHiring} onClick={() => void setStep("applying")}>
            Apply now
          </Button>

          {otherRoles.length > 0 && (
            <section className="block text-center">
              <h2 className="mb-2 text-xl font-bold">Other available roles</h2>
              <ul className="prose inline-block">
                {otherRoles.map((role) => (
                  <li key={role.id}>
                    <Link href={`/roles/${companySlug}/${toSlug(role.name)}-${role.id}`}>{role.name}</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <Card>
          <CardContent>
            <div className="grid gap-4">
              <Input
                value={values.name}
                onChange={(name) => updateValues({ name })}
                label="Name"
                invalid={errors.has("name")}
              />

              <Input
                value={values.email}
                onChange={(email) => updateValues({ email })}
                label="Email"
                type="email"
                invalid={errors.has("email")}
              />

              <Select
                value={values.countryCode}
                onChange={(countryCode) => updateValues({ countryCode })}
                options={Object.entries(countryInfos).map(([code, info]) => ({
                  value: code,
                  disabled: !info.supportsWisePayout,
                  label: `${info.countryName}${info.supportsWisePayout ? "" : " (unsupported)"}`,
                }))}
                label="Country (where you'll usually work from)"
                invalid={errors.has("countryCode")}
              />

              {role.payRateType === PayRateType.Hourly && (
                <>
                  <RangeInput
                    value={values.hoursPerWeek}
                    onChange={(hoursPerWeek) => updateValues({ hoursPerWeek })}
                    min={10}
                    max={MAX_WORKING_HOURS_PER_WEEK}
                    aria-label="Hours per week"
                    unit="hours"
                    label="How many hours per week will you work?"
                  />
                  <RangeInput
                    value={values.weeksPerYear}
                    onChange={(weeksPerYear) => updateValues({ weeksPerYear })}
                    min={20}
                    max={WORKING_WEEKS_PER_YEAR}
                    aria-label="Weeks per year"
                    unit="weeks"
                    label="How many weeks a year will you work?"
                  />
                </>
              )}

              <RichTextEditor
                value={values.description}
                onChange={(value) => updateValues({ description: value })}
                label="Briefly describe your career and provide links to key projects as proof of work"
                invalid={errors.has("description")}
                className="h-48"
              />
            </div>
          </CardContent>
          <CardFooter className="border-0 pt-0 [&>button]:w-full">
            <MutationButton mutation={submitMutation} loadingText="Submitting application...">
              Submit application
            </MutationButton>
          </CardFooter>
        </Card>
      )}
    </SimpleLayout>
  );
}
