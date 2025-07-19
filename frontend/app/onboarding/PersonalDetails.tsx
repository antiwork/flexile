"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { MutationStatusButton } from "@/components/MutationButton";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCurrentUser } from "@/global";
import { countries, sanctionedCountries } from "@/models/constants";
import { cn } from "@/utils";
import { request } from "@/utils/request";
import { onboarding_path } from "@/utils/routes";

const formSchema = z.object({
  legal_name: z.string().refine((val) => /\S+\s+\S+/u.test(val), "This doesn't look like a complete full name."),
  preferred_name: z.string().min(1, "This field is required"),
  country_code: z.string().min(1, "This field is required"),
  citizenship_country_code: z.string().min(1, "This field is required"),
});

const CountrySelector = ({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) => {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const countryOptions = [...countries].map(([code, name]) => ({ value: code, label: name }));
  const getLabel = (value: string) => countryOptions.find((o) => o.value === value)?.label;

  const filteredOptions = searchValue
    ? countryOptions.filter(
        (option) =>
          option.label.toLowerCase().includes(searchValue.toLowerCase()) ||
          option.value.toLowerCase().includes(searchValue.toLowerCase()),
      )
    : countryOptions;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="small" role="combobox" aria-expanded={open} className="justify-between">
          <div className="truncate">{value ? getLabel(value) : placeholder}</div>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search..." value={searchValue} onValueChange={setSearchValue} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={(currentValue) => {
                    onChange(currentValue);
                    setOpen(false);
                    setSearchValue("");
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", option.value === value ? "opacity-100" : "opacity-0")} />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const PersonalDetails = () => {
  const user = useCurrentUser();
  const router = useRouter();
  const { data } = useSuspenseQuery({
    queryKey: ["onboarding"],
    queryFn: async () => {
      const response = await request({ method: "GET", url: onboarding_path(), accept: "json", assertOk: true });
      return z
        .object({
          legal_name: z.string().nullable(),
          preferred_name: z.string().nullable(),
          country_code: z.string().nullable(),
          citizenship_country_code: z.string().nullable(),
        })
        .parse(await response.json());
    },
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [confirmNoPayout, setConfirmNoPayout] = useState(false);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      legal_name: data.legal_name || "",
      preferred_name: data.preferred_name || "",
      country_code: data.country_code || "",
      citizenship_country_code: data.citizenship_country_code || "",
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      await request({
        method: "PATCH",
        url: onboarding_path(),
        accept: "json",
        jsonData: { user: form.getValues() },
        assertOk: true,
      });
      router.push("/dashboard");
    },
  });

  const submit = form.handleSubmit((values) => {
    if (!confirmNoPayout && sanctionedCountries.has(values.country_code)) {
      setModalOpen(true);
      throw new Error("Sanctioned country");
    }

    save.mutate();
  });

  return (
    <>
      <Form {...form}>
        <form className="grid gap-4" onSubmit={(e) => void submit(e)}>
          <FormField
            control={form.control}
            name="legal_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full legal name (must match your ID)</FormLabel>
                <FormControl>
                  <Input {...field} autoFocus />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="preferred_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preferred name (visible to others)</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-3 md:grid-cols-2">
            <FormField
              control={form.control}
              name="country_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country of residence</FormLabel>
                  <FormControl>
                    <CountrySelector {...field} placeholder="Select country" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="citizenship_country_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country of citizenship</FormLabel>
                  <FormControl>
                    <CountrySelector {...field} placeholder="Select country" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <MutationStatusButton type="submit" mutation={save} loadingText="Saving..." className="justify-self-end">
            Continue
          </MutationStatusButton>
        </form>
      </Form>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Important notice</DialogTitle>
          </DialogHeader>
          <p>
            Unfortunately, due to regulatory restrictions and compliance with international sanctions, individuals from
            sanctioned countries are unable to receive payments through our platform.
          </p>
          <p>
            You can still use Flexile's features such as
            {user.roles.worker ? " sending invoices and " : " "} receiving equity, but
            <b> you won't be able to set a payout method or receive any payments</b>.
          </p>
          <DialogFooter>
            <Button
              onClick={() => {
                setConfirmNoPayout(true);
                setModalOpen(false);
                save.mutate();
              }}
            >
              Proceed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PersonalDetails;
