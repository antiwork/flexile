import { SignOutButton } from "@clerk/nextjs";
import { ChevronRight, Ellipsis, LogOut, type LucideIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { type Dispatch, Fragment, type ReactNode, type RefObject, type SetStateAction, useRef, useState } from "react";
import CompanySwitcher from "@/components/CompanySwitcher";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { NavType } from "@/lib/navigation";

type SheetKeyType = string | null;

interface NavTabType {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  isVisible: boolean;
  badge?: number;
}

interface ListSheetNavChildrenType {
  icon?: LucideIcon;
  label: string;
  route?: Route;
  isActive: boolean;
  element?: ReactNode;
}

function TabBar({ nav, type }: { nav: NavType[]; type: "main" | "settings" }) {
  const [activeSheetKey, setActiveSheetKey] = useState<SheetKeyType>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);
  nav.sort((a, b) => a.tabPriority - b.tabPriority);
  const mainNav = nav.slice(0, 3);
  const closeActiveSheet = () => {
    if (activeSheetKey) {
      setActiveSheetKey(null);
    }
  };
  const moreNavChildren = [
    ...(type === "main"
      ? [{ label: "Company Switcher", isVisible: true, isActive: false, element: <CompanySwitcher /> }]
      : []),
    ...nav.slice(3),
    ...(type === "main"
      ? [
          {
            label: "Log out",
            isVisible: true,
            isActive: false,
            element: (
              <SignOutButton>
                <div className="flex w-full grow-1 items-center gap-2">
                  <div className="w-6">
                    <LogOut />
                  </div>
                  <div>Log out</div>
                </div>
              </SignOutButton>
            ),
          },
        ]
      : []),
  ];

  const moreNav: NavTabType & { children: ListSheetNavChildrenType[] } = {
    label: "More",
    icon: Ellipsis,
    isVisible: moreNavChildren.length > 0,
    isActive: false,
    children: moreNavChildren,
  };

  return (
    <nav
      className="bg-background border-muted pointer-events-auto fixed right-0 bottom-0 left-0 z-[60] flex border-t [&>*]:grow"
      ref={tabBarRef}
      aria-label="Tab bar"
    >
      {mainNav.map((item) =>
        item.children ? (
          <ListSheet
            key={item.label}
            navTab={item}
            navChildren={item.children}
            activeSheetKey={activeSheetKey}
            setActiveSheetKey={setActiveSheetKey}
            excludeFromBackdrop={tabBarRef}
          />
        ) : (
          <Link href={item.route} key={item.label} onClick={closeActiveSheet}>
            <NavTab tab={item} activeSheetKey={activeSheetKey} />
          </Link>
        ),
      )}
      {moreNav.isVisible ? (
        <ListSheet
          navTab={moreNav}
          navChildren={moreNav.children}
          activeSheetKey={activeSheetKey}
          setActiveSheetKey={setActiveSheetKey}
          excludeFromBackdrop={tabBarRef}
        />
      ) : null}
    </nav>
  );
}

const NavTab = ({
  tab,
  activeSheetKey,
  sheetKey,
}: {
  tab: NavTabType;
  activeSheetKey: SheetKeyType;
  sheetKey?: SheetKeyType;
}) => {
  const { label, icon: Icon, badge } = tab;
  // Navtab is shown active based on either its isActive status or if any option sheet is open
  const isActive = activeSheetKey ? activeSheetKey === sheetKey : tab.isActive;
  return (
    <div className={`flex cursor-pointer flex-col items-center gap-1 px-2 py-4 ${!isActive ? "text-gray-500" : ""}`}>
      <div className="relative">
        {badge && badge > 0 ? (
          <Badge role="status" className="absolute -top-0.5 -right-0.5 border border-white bg-blue-500 p-1" />
        ) : null}
        <Icon width={20} height={20} />
      </div>
      <span className="text-xs">{label}</span>
    </div>
  );
};

const ListSheet = ({
  navTab,
  navChildren,
  activeSheetKey,
  setActiveSheetKey,
  excludeFromBackdrop,
}: {
  navTab: NavTabType;
  navChildren: ListSheetNavChildrenType[];
  activeSheetKey: SheetKeyType;
  setActiveSheetKey: Dispatch<SetStateAction<SheetKeyType>>;
  excludeFromBackdrop?: RefObject<HTMLElement | null>;
}) => {
  const sheetKey = navTab.label.toLowerCase().replace(" ", "-");
  const handleOpenChange = (open: boolean) => {
    setActiveSheetKey(open ? sheetKey : null);
  };
  const closeSheet = () => {
    setActiveSheetKey(null);
  };

  return (
    <Sheet open={activeSheetKey === sheetKey} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <button>
          <NavTab tab={navTab} activeSheetKey={activeSheetKey} sheetKey={sheetKey} />
        </button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="z-[50] mb-18 h-auto max-h-[70vh] gap-1 rounded-t-[20px] border-t-0 [&>button]:hidden"
        onPointerDownOutside={(e) => {
          if (e.target instanceof Node && excludeFromBackdrop?.current?.contains(e.target)) {
            e.preventDefault();
          }
        }}
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="font-semibold">{navTab.label}</SheetTitle>
          <SheetDescription className="sr-only">{navTab.label} Options</SheetDescription>
        </SheetHeader>
        <div className="pb-3">
          {navChildren.map((item) => (
            <div
              key={item.label}
              className={`hover:text-accent-foreground [&_svg]:size-4 [&>*]:flex [&>*]:cursor-pointer [&>*]:items-center [&>*]:px-6 [&>*]:py-3 ${item.isActive ? "bg-gray-100/50" : "hover:bg-gray-100/30"} `}
            >
              {item.route ? (
                <Link href={item.route} onClick={closeSheet}>
                  <div className="flex grow-1 items-center gap-2">
                    {item.icon ? (
                      <div className="w-6">
                        <item.icon />
                      </div>
                    ) : null}
                    <div>{item.label}</div>
                  </div>
                  <ChevronRight />
                </Link>
              ) : (
                <Fragment key={item.label}>{item.element}</Fragment>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default TabBar;
