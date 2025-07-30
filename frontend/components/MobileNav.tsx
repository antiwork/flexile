import { SignOutButton } from "@clerk/nextjs";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { skipToken } from "@tanstack/react-query";
import { capitalize } from "lodash-es";
import {
  ChartPie,
  ChevronRight,
  ChevronsUpDown,
  Ellipsis,
  Files,
  LogOut,
  type LucideProps,
  ReceiptIcon,
  Rss,
  Settings,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useMemo, useState } from "react";
import { navLinks as equityNavLinks } from "@/app/(dashboard)/equity";
import { useIsActionable } from "@/app/(dashboard)/invoices";
import { companyLinks, personalLinks } from "@/app/settings";
import { CompanyName } from "@/components/CompanyName";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { switchCompany } from "@/lib/switch-company";
import { trpc } from "@/trpc/client";
import { cn } from "@/utils";
import defaultCompanyLogo from "../images/default-company-logo.svg";

const NAV_HEIGHT_PX = 49;
type DialogType = "equity" | "show_more" | null;
type SubmenuType = "organizations" | "settings" | null;

const MobileNav = () => {
  const pathname = usePathname();
  const user = useCurrentUser();
  const company = useCurrentCompany();
  const [dialog, setDialog] = useState<DialogType>(null);
  const [submenu, setSubmenu] = useState<SubmenuType>(null);
  const updatesPath = company.routes.find((route) => route.label === "Updates")?.name;
  const filteredPersonalLinks = personalLinks.filter((link) => link.isVisible(user));
  const filteredCompanyLinks = companyLinks.filter((link) => link.isVisible(user));
  const isInvoiceActionable = useIsActionable();
  const equityLinks = useMemo(() => equityNavLinks(user, company), [user, company]);

  const routes = useMemo(
    () =>
      new Set(
        company.routes.flatMap((route) => [route.label, ...(route.subLinks?.map((subLink) => subLink.label) || [])]),
      ),
    [company.routes],
  );

  const { data: invoicesData } = trpc.invoices.list.useQuery(
    user.currentCompanyId && user.roles.administrator
      ? { companyId: user.currentCompanyId, status: ["received", "approved", "failed"] }
      : skipToken,
    { refetchInterval: 30_000 },
  );

  const toggleDialog = (dialogType: DialogType) => {
    if (dialogType === null) {
      setDialog(null);
      // Hide submenu when dialog close animation finishes
      if (submenu) {
        setTimeout(() => {
          setSubmenu(null);
        }, 300);
      }
    } else {
      if (dialogType === dialog) return toggleDialog(null);
      setDialog(dialogType);
    }
  };

  const renderEquityDialog = () => (
    <BottomSheetDialog open={dialog === "equity"} title="Equity" onClose={() => toggleDialog(null)}>
      {equityLinks.map((item, index) => (
        <Link
          key={index}
          href={item.route}
          className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
          onClick={() => {
            toggleDialog(null);
          }}
        >
          <span>{item.label}</span>
          <ChevronRight className="size-4 text-gray-600" />
        </Link>
      ))}
    </BottomSheetDialog>
  );
  const renderShowMoreDialog = () => (
    <BottomSheetDialog
      open={dialog === "show_more"}
      title={submenu ? capitalize(submenu) : "More"}
      onClose={() => {
        toggleDialog(null);
      }}
      submenu={!!submenu}
      onGoBack={() => {
        setSubmenu(null);
      }}
    >
      {/* MAIN MENU */}
      {submenu === null && (
        <>
          {user.companies.length > 1 ? (
            <button
              onClick={() => setSubmenu("organizations")}
              className="flex w-full cursor-pointer items-center gap-2 px-6 py-4 hover:bg-gray-50"
            >
              <CompanyName />
              <ChevronsUpDown className="ml-auto size-4 text-gray-600" />
            </button>
          ) : user.companies[0]?.name ? (
            <div className="flex items-center gap-2 px-6 py-4">
              <CompanyName />
            </div>
          ) : null}

          {updatesPath ? (
            <Link
              href="/updates/company"
              className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
              onClick={() => toggleDialog(null)}
            >
              <div className="flex items-center gap-2">
                <div className="flex size-6 items-center justify-center">
                  <Rss className="size-4" />
                </div>
                <span>Updates</span>
              </div>
              <ChevronRight className="size-4 text-gray-600" />
            </Link>
          ) : null}

          <button
            className="flex w-full cursor-pointer items-center justify-between px-6 py-4 hover:bg-gray-50"
            onClick={() => setSubmenu("settings")}
          >
            <div className="flex gap-2">
              <div className="flex size-6 items-center justify-center">
                <Settings className="size-4" />
              </div>
              <span>Settings</span>
            </div>
            <ChevronRight className="size-4 text-gray-600" />
          </button>

          <SignOutButton>
            <Link href="#" className="flex items-center px-6 py-4 hover:bg-gray-50" onClick={() => toggleDialog(null)}>
              <div className="flex gap-2">
                <div className="flex size-6 items-center justify-center">
                  <LogOut className="size-4" />
                </div>
                <span>Log out</span>
              </div>
            </Link>
          </SignOutButton>
        </>
      )}

      {/* SETTINGS SUBMENU */}
      {submenu === "settings" && (
        <>
          {filteredCompanyLinks.length ? (
            <div className="flex h-9 items-center px-4.5 text-sm text-gray-600">Personal</div>
          ) : null}
          {filteredPersonalLinks.map((link) => (
            <Link
              key={link.route}
              href={link.route}
              className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
              onClick={() => toggleDialog(null)}
            >
              <div className="flex items-center gap-2">
                <div className="flex size-6 items-center justify-center">
                  <link.icon className="size-4" />
                </div>
                <span>{link.label}</span>
              </div>
              <ChevronRight className="size-4 text-gray-600" />
            </Link>
          ))}
          {filteredCompanyLinks.length ? (
            <>
              <div className="bg-border my-4 h-px"></div>
              <div className="flex h-9 items-center px-4.5 text-sm text-gray-600">Company</div>
            </>
          ) : null}

          {filteredCompanyLinks.map((link) => (
            <Link
              href={link.route}
              className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
              onClick={() => toggleDialog(null)}
              key={link.route}
            >
              <div className="flex items-center gap-2">
                <div className="flex size-6 items-center justify-center">
                  <link.icon className="size-4" />
                </div>
                <span>{link.label}</span>
              </div>
              <ChevronRight className="size-4 text-gray-600" />
            </Link>
          ))}
        </>
      )}

      {/* ORGANIZATIONS SUBMENU */}
      {submenu === "organizations" && (
        <>
          {user.companies.map((company) => (
            <button
              key={company.id}
              onClick={() => {
                if (user.currentCompanyId !== company.id) switchCompany(company.id);
              }}
              className="flex w-full cursor-pointer items-center gap-2 px-6 py-4 hover:bg-gray-50"
            >
              <Image
                src={company.logo_url || defaultCompanyLogo}
                width={20}
                height={20}
                className="rounded-xs"
                alt=""
              />
              <span className="line-clamp-1">{company.name}</span>
              {company.id === user.currentCompanyId && <div className="ml-auto size-2 rounded-full bg-blue-500"></div>}
            </button>
          ))}
        </>
      )}
    </BottomSheetDialog>
  );

  return (
    <>
      {renderEquityDialog()}
      {renderShowMoreDialog()}
      <nav
        className="pointer-events-auto fixed inset-x-0 bottom-0 z-[45] flex bg-white pt-0.5"
        style={{
          height: `calc(${NAV_HEIGHT_PX}px + env(safe-area-inset-bottom))`,
          paddingBottom: `env(safe-area-inset-bottom)`,
        }}
      >
        {routes.has("Invoices") && (
          <MobileNavItem
            href="/invoices"
            icon={ReceiptIcon}
            active={pathname.startsWith("/invoices")}
            badge={invoicesData?.filter(isInvoiceActionable).length ?? 0}
            onClick={() => toggleDialog(null)}
            iconActive={ReceiptFilled}
          >
            Invoices
          </MobileNavItem>
        )}
        {routes.has("Documents") && (
          <MobileNavItem
            href="/documents"
            icon={Files}
            active={pathname.startsWith("/documents") || pathname.startsWith("/document_templates")}
            onClick={() => toggleDialog(null)}
            iconActive={FilesFilled}
          >
            Documents
          </MobileNavItem>
        )}
        {routes.has("People") && (
          <MobileNavItem
            href="/people"
            icon={Users}
            active={pathname.startsWith("/people") || pathname.includes("/investor_entities/")}
            onClick={() => toggleDialog(null)}
            iconActive={UsersFilled}
          >
            People
          </MobileNavItem>
        )}
        {routes.has("Equity") && equityLinks.length > 0 && (
          <MobileNavItem
            href="#"
            icon={ChartPie}
            active={pathname.startsWith("/equity")}
            onClick={(e) => {
              e.preventDefault();
              toggleDialog("equity");
            }}
            iconActive={ChartPieFilled}
          >
            Equity
          </MobileNavItem>
        )}
        <MobileNavItem
          href="#"
          icon={Ellipsis}
          active={pathname.startsWith("/settings")}
          onClick={(e) => {
            e.preventDefault();
            toggleDialog("show_more");
          }}
          iconActive={EllipsisFilled}
        >
          More
        </MobileNavItem>
      </nav>
    </>
  );
};

const BottomSheetDialog = ({
  open,
  title,
  children,
  onClose,
  submenu,
  onGoBack,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  submenu?: boolean;
  onGoBack?: () => void;
}) => (
  <DialogPrimitive.Root open={open}>
    <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-gray-100/18" onClick={onClose} />
    <DialogPrimitive.Content
      className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed inset-x-0 z-[50] flex max-h-[75vh] flex-col rounded-t-2xl bg-white pb-2 data-[state=closed]:duration-300 data-[state=open]:duration-200"
      style={{
        boxShadow: "0px -2px 4px -2px rgba(0,0,0,0.1), 0px -4px 6px -1px rgba(0,0,0,0.1)",
        bottom: `calc(${NAV_HEIGHT_PX}px + env(safe-area-inset-bottom))`,
      }}
    >
      <div className="flex shrink-0 gap-2.5 px-6 pt-5 pb-3" onClick={onGoBack}>
        {submenu ? (
          <div className="flex size-6 items-center justify-center">
            <ChevronRight className="size-4 rotate-180" />
          </div>
        ) : null}
        <DialogPrimitive.Title className="font-medium">{title}</DialogPrimitive.Title>
      </div>
      <div className="border-border flex-1 overflow-y-auto border-b">{children}</div>
    </DialogPrimitive.Content>
  </DialogPrimitive.Root>
);

const MobileNavItem = ({
  icon: Icon,
  children,
  active,
  badge,
  iconActive: IconActive,
  ...props
}: React.ComponentProps<typeof Link> & {
  active?: boolean;
  icon: React.ComponentType<LucideProps>;
  iconActive: React.ComponentType<LucideProps>;
  badge?: number;
}) => (
  <Link
    className={cn(
      "flex h-full flex-1 flex-col items-center justify-center gap-1 transition-opacity",
      active ? "opacity-100" : "opacity-50",
    )}
    {...props}
  >
    <div className="relative">
      {active ? <IconActive /> : <Icon className="size-5" />}
      {badge && badge > 0 ? (
        <div className="absolute -top-1 -right-1 size-3.5 rounded-full border-2 border-white bg-blue-600" />
      ) : null}
    </div>
    <span className="text-[10px] leading-4">{children}</span>
  </Link>
);

const ReceiptFilled = () => (
  <svg width="20" height="20" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M3.58325 2.16675V18.8334L5.24992 18.0001L6.91659 18.8334L8.58325 18.0001L10.2499 18.8334L11.9166 18.0001L13.5833 18.8334L15.2499 18.0001L16.9166 18.8334V2.16675L15.2499 3.00008L13.5833 2.16675L11.9166 3.00008L10.2499 2.16675L8.58325 3.00008L6.91659 2.16675L5.24992 3.00008L3.58325 2.16675Z"
      fill="#1D1E17"
      stroke="#1D1E17"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13.5834 7.16675H8.58341C8.14139 7.16675 7.71746 7.34234 7.4049 7.6549C7.09234 7.96746 6.91675 8.39139 6.91675 8.83341C6.91675 9.27544 7.09234 9.69937 7.4049 10.0119C7.71746 10.3245 8.14139 10.5001 8.58341 10.5001H11.9167C12.3588 10.5001 12.7827 10.6757 13.0953 10.9882C13.4078 11.3008 13.5834 11.7247 13.5834 12.1667C13.5834 12.6088 13.4078 13.0327 13.0953 13.3453C12.7827 13.6578 12.3588 13.8334 11.9167 13.8334H6.91675"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M10.25 15.0834V5.91675" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const FilesFilled = () => (
  <svg width="20" height="20" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M17.4167 6.33317H14.9167C14.4746 6.33317 14.0507 6.15758 13.7382 5.84502C13.4256 5.53245 13.25 5.10853 13.25 4.6665V2.1665"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8.24992 15.5001C7.80789 15.5001 7.38397 15.3245 7.07141 15.0119C6.75885 14.6994 6.58325 14.2754 6.58325 13.8334V3.83341C6.58325 3.39139 6.75885 2.96746 7.07141 2.6549C7.38397 2.34234 7.80789 2.16675 8.24992 2.16675H14.0833L17.4166 5.50008V13.8334C17.4166 14.2754 17.241 14.6994 16.9284 15.0119C16.6159 15.3245 16.1919 15.5001 15.7499 15.5001H8.24992Z"
      fill="#1D1E17"
      stroke="#1D1E17"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M17.4167 6.33317H14.9167C14.4746 6.33317 14.0507 6.15758 13.7382 5.84502C13.4256 5.53245 13.25 5.10853 13.25 4.6665V2.1665"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="round"
    />
    <path
      d="M3.25 6.83325V17.4999C3.25 17.8535 3.39048 18.1927 3.64052 18.4427C3.89057 18.6928 4.22971 18.8333 4.58333 18.8333H12.75"
      stroke="#1D1E17"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const UsersFilled = () => (
  <svg width="20" height="20" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M13.3334 18V16.3333C13.3334 15.4493 12.9822 14.6014 12.3571 13.9763C11.732 13.3512 10.8841 13 10.0001 13H5.00008C4.11603 13 3.26818 13.3512 2.64306 13.9763C2.01794 14.6014 1.66675 15.4493 1.66675 16.3333V18"
      fill="#1D1E17"
    />
    <path
      d="M13.3334 18V16.3333C13.3334 15.4493 12.9822 14.6014 12.3571 13.9763C11.732 13.3512 10.8841 13 10.0001 13H5.00008C4.11603 13 3.26818 13.3512 2.64306 13.9763C2.01794 14.6014 1.66675 15.4493 1.66675 16.3333V18"
      stroke="#1D1E17"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7.50008 9.66667C9.34103 9.66667 10.8334 8.17428 10.8334 6.33333C10.8334 4.49238 9.34103 3 7.50008 3C5.65913 3 4.16675 4.49238 4.16675 6.33333C4.16675 8.17428 5.65913 9.66667 7.50008 9.66667Z"
      fill="#1D1E17"
      stroke="#1D1E17"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M18.3333 17.9999V16.3333C18.3327 15.5947 18.0869 14.8773 17.6344 14.2935C17.1819 13.7098 16.5484 13.2929 15.8333 13.1083"
      fill="#D9D9D9"
    />
    <path
      d="M18.3333 17.9999V16.3333C18.3327 15.5947 18.0869 14.8773 17.6344 14.2935C17.1819 13.7098 16.5484 13.2929 15.8333 13.1083"
      stroke="#1D1E17"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13.3333 3.10828C14.0503 3.29186 14.6858 3.70886 15.1396 4.29353C15.5935 4.87821 15.8398 5.5973 15.8398 6.33744C15.8398 7.07758 15.5935 7.79668 15.1396 8.38135C14.6858 8.96602 14.0503 9.38303 13.3333 9.56661"
      fill="#1D1E17"
    />
    <path
      d="M13.3333 3.10828C14.0503 3.29186 14.6858 3.70886 15.1396 4.29353C15.5935 4.87821 15.8398 5.5973 15.8398 6.33744C15.8398 7.07758 15.5935 7.79668 15.1396 8.38135C14.6858 8.96603 14.0503 9.38303 13.3333 9.56661"
      stroke="#1D1E17"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChartPieFilled = () => (
  <svg width="20" height="20" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M17.7501 10.4999C18.2101 10.4999 18.5876 10.1258 18.5418 9.66827C18.3496 7.75507 17.5018 5.96719 16.142 4.6077C14.7822 3.24822 12.9942 2.4008 11.0809 2.2091C10.6226 2.16327 10.2493 2.54077 10.2493 3.00077V9.66743C10.2493 9.88845 10.3371 10.1004 10.4933 10.2567C10.6496 10.413 10.8616 10.5008 11.0826 10.5008L17.7501 10.4999Z"
      fill="#1D1E17"
      stroke="black"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M17.9249 13.7417C17.3948 14.9955 16.5656 16.1002 15.5098 16.9595C14.4541 17.8187 13.2039 18.4063 11.8686 18.6707C10.5333 18.9352 9.15361 18.8685 7.85005 18.4766C6.54649 18.0846 5.35878 17.3793 4.39078 16.4223C3.42277 15.4653 2.70394 14.2857 2.29712 12.9867C1.89031 11.6877 1.8079 10.3088 2.05709 8.97059C2.30629 7.63238 2.87951 6.37559 3.72663 5.31009C4.57376 4.24459 5.669 3.40283 6.9166 2.8584"
      stroke="black"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const EllipsisFilled = () => (
  <svg width="20" height="20" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10.7498 11.3334C11.2101 11.3334 11.5832 10.9603 11.5832 10.5001C11.5832 10.0398 11.2101 9.66675 10.7498 9.66675C10.2896 9.66675 9.9165 10.0398 9.9165 10.5001C9.9165 10.9603 10.2896 11.3334 10.7498 11.3334Z"
      stroke="black"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16.5833 11.3334C17.0436 11.3334 17.4167 10.9603 17.4167 10.5001C17.4167 10.0398 17.0436 9.66675 16.5833 9.66675C16.1231 9.66675 15.75 10.0398 15.75 10.5001C15.75 10.9603 16.1231 11.3334 16.5833 11.3334Z"
      stroke="black"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M4.91683 11.3334C5.37707 11.3334 5.75016 10.9603 5.75016 10.5001C5.75016 10.0398 5.37707 9.66675 4.91683 9.66675C4.45659 9.66675 4.0835 10.0398 4.0835 10.5001C4.0835 10.9603 4.45659 11.3334 4.91683 11.3334Z"
      stroke="black"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default MobileNav;
