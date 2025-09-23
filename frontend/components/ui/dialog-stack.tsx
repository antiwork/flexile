"use client";

import { Portal } from "@radix-ui/react-portal";
import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { XIcon } from "lucide-react";
import type {
  ButtonHTMLAttributes,
  Dispatch,
  HTMLAttributes,
  MouseEvent,
  MouseEventHandler,
  ReactElement,
  SetStateAction,
} from "react";
import { Children, cloneElement, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { cn } from "@/utils/index";

type DialogStackContextType = {
  activeIndex: number;
  setActiveIndex: Dispatch<SetStateAction<number>>;
  totalDialogs: number;
  setTotalDialogs: Dispatch<SetStateAction<number>>;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  clickable: boolean;
};

const DialogStackContext = createContext<DialogStackContextType | null>({
  activeIndex: 0,
  setActiveIndex: () => undefined,
  totalDialogs: 0,
  setTotalDialogs: () => undefined,
  isOpen: false,
  setIsOpen: () => undefined,
  clickable: false,
});

type DialogStackChildProps = {
  index?: number;
};

export type DialogStackProps = HTMLAttributes<HTMLDivElement> & {
  open?: boolean;
  clickable?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  activeIndex?: number;
  setActiveIndex?: Dispatch<SetStateAction<number>>;
};

export const DialogStack = ({
  children,
  className,
  open,
  defaultOpen = false,
  onOpenChange,
  clickable = false,
  activeIndex: activeIndexProp,
  setActiveIndex: setActiveIndexProp,
  ...props
}: DialogStackProps) => {
  const [activeIndex, setActiveIndex] = useControllableState({
    defaultProp: 0,
    prop: activeIndexProp,
    ...(setActiveIndexProp ? { onChange: setActiveIndexProp } : {}),
  });
  const [isOpen, setIsOpen] = useControllableState({
    defaultProp: defaultOpen,
    prop: open,
    ...(onOpenChange ? { onChange: onOpenChange } : {}),
  });
  useEffect(() => setActiveIndex(0), [isOpen]);

  const contextValue = useMemo(
    () => ({
      activeIndex,
      setActiveIndex,
      totalDialogs: 0,
      setTotalDialogs: () => undefined,
      isOpen,
      setIsOpen,
      clickable,
    }),
    [activeIndex, isOpen, clickable],
  );

  return (
    <DialogStackContext.Provider value={contextValue}>
      <div className={className} {...props}>
        {children}
      </div>
    </DialogStackContext.Provider>
  );
};

export type DialogStackTriggerProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  children?: ReactElement<{
    onClick: MouseEventHandler<HTMLButtonElement>;
    className?: string;
  }>;
  asChild?: boolean;
};

export const DialogStackTrigger = ({ children, className, onClick, asChild, ...props }: DialogStackTriggerProps) => {
  const context = useContext(DialogStackContext);

  if (!context) {
    throw new Error("DialogStackTrigger must be used within a DialogStack");
  }

  const handleClick: MouseEventHandler<HTMLButtonElement> = (e) => {
    context.setIsOpen(true);
    onClick?.(e);
  };

  if (asChild && children) {
    return cloneElement(children, {
      ...props,
      onClick:
        onClick ??
        ((e: MouseEvent<HTMLButtonElement>) => {
          handleClick(e);
          children.props.onClick(e);
        }),
      className: cn(className, children.props.className),
    });
  }

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium whitespace-nowrap",
        "ring-offset-background transition-colors focus-visible:ring-2 focus-visible:outline-none",
        "focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        "bg-primary text-primary-foreground hover:bg-primary/90",
        "h-10 px-4 py-2",
        className,
      )}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
};

export type DialogStackOverlayProps = HTMLAttributes<HTMLDivElement>;

export const DialogStackOverlay = ({ className, ...props }: DialogStackOverlayProps) => {
  const context = useContext(DialogStackContext);

  if (!context) {
    throw new Error("DialogStackOverlay must be used within a DialogStack");
  }

  const handleClick = useCallback(() => {
    context.setIsOpen(false);
  }, [context.setIsOpen]);

  if (!context.isOpen) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 bg-black/80",
        "data-[state=closed]:animate-out data-[state=open]:animate-in",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      onClick={handleClick}
      {...props}
    />
  );
};

export type DialogStackBodyProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactElement<DialogStackChildProps>[] | ReactElement<DialogStackChildProps>;
};

export const DialogStackBody = ({ children, className, ...props }: DialogStackBodyProps) => {
  const context = useContext(DialogStackContext);
  const [totalDialogs, setTotalDialogs] = useState(Children.count(children));

  if (!context) {
    throw new Error("DialogStackBody must be used within a DialogStack");
  }

  const contextValue = useMemo(
    () => ({
      ...context,
      totalDialogs,
      setTotalDialogs,
    }),
    [context, totalDialogs],
  );

  if (!context.isOpen) {
    return null;
  }

  return (
    <DialogStackContext.Provider value={contextValue}>
      <DialogStackOverlay />
      <Portal>
        <div
          role="dialog"
          className={cn(
            "pointer-events-none fixed inset-0 z-50 mx-auto flex max-h-[90vh] w-full max-w-lg flex-col items-center justify-start p-2 pt-16 sm:max-h-[95vh] sm:pt-32",
            className,
          )}
          {...props}
        >
          <div className="pointer-events-auto relative flex max-h-full w-full flex-col items-center justify-center">
            {Children.map(children, (child, index) => (
              // eslint-disable-next-line react/jsx-no-constructed-context-values -- can't use useMemo in a loop
              <DialogStackContentContext.Provider value={{ index }} key={index}>
                {child}
              </DialogStackContentContext.Provider>
            ))}
          </div>
        </div>
      </Portal>
    </DialogStackContext.Provider>
  );
};

const DialogStackContentContext = createContext<{ index: number } | null>(null);

export type DialogStackContentProps = HTMLAttributes<HTMLDivElement> & {
  offset?: number;
};

export const DialogStackContent = ({ children, className, offset = 16, ...props }: DialogStackContentProps) => {
  const context = useContext(DialogStackContext);
  const indexContext = useContext(DialogStackContentContext);

  if (!context) {
    throw new Error("DialogStackContent must be used within a DialogStack");
  }

  if (!indexContext) {
    throw new Error("DialogStackContent must be used within a DialogStackBody");
  }
  const { index } = indexContext;

  if (!context.isOpen) {
    return null;
  }

  const handleClick = () => {
    if (context.clickable && context.activeIndex < index) {
      context.setActiveIndex(index);
    }
  };

  const distanceFromActive = context.activeIndex - index;
  const translateY =
    distanceFromActive < 0
      ? `-${Math.abs(distanceFromActive) * offset}px`
      : `${Math.abs(distanceFromActive) * offset}px`;

  return (
    <div
      className={cn(
        "bg-background h-auto max-h-full w-full rounded-lg border border-gray-200 p-6 shadow-lg transition-all duration-300",
        className,
      )}
      onClick={handleClick}
      style={{
        top: 0,
        transform: `translateY(${translateY})`,
        width: `calc(100% - ${Math.abs(distanceFromActive) * 32}px)`,
        zIndex: 50 - Math.abs(context.activeIndex - index),
        position: distanceFromActive ? "absolute" : "relative",
        opacity: distanceFromActive > 0 ? 0 : 1,
        cursor: context.clickable && context.activeIndex < index ? "pointer" : "default",
      }}
      {...props}
    >
      <button
        data-slot="dialog-close"
        className="ring-offset-background focus:ring-ring/15 data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-[26px] right-5 cursor-pointer rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
        onClick={() => context.setIsOpen(false)}
      >
        <XIcon />
        <span className="sr-only">Close</span>
      </button>
      <div
        className={cn(
          "grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)_auto] gap-4",
          context.activeIndex !== index && "pointer-events-none opacity-0 select-none",
        )}
      >
        {children}
      </div>
    </div>
  );
};

export type DialogStackTitleProps = HTMLAttributes<HTMLHeadingElement>;

export const DialogStackTitle = ({ children, className, ...props }: DialogStackTitleProps) => (
  <h2 className={cn("text-lg leading-none font-semibold tracking-tight", className)} {...props}>
    {children}
  </h2>
);

export type DialogStackDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export const DialogStackDescription = ({ children, className, ...props }: DialogStackDescriptionProps) => (
  <p className={cn("text-muted-foreground text-sm", className)} {...props}>
    {children}
  </p>
);

export type DialogStackHeaderProps = HTMLAttributes<HTMLDivElement>;

export const DialogStackHeader = ({ className, ...props }: DialogStackHeaderProps) => (
  <div className={cn("flex flex-col space-y-1.5 text-left", className)} {...props} />
);

export type DialogStackFooterProps = HTMLAttributes<HTMLDivElement>;

export const DialogStackFooter = ({ children, className, ...props }: DialogStackFooterProps) => (
  <div className={cn("flex items-center justify-end space-x-2", "sm:[&_button]:py-1.25", className)} {...props}>
    {children}
  </div>
);

export type DialogStackNextProps = Omit<HTMLAttributes<HTMLDivElement>, "onClick">;

export const DialogStackNext = (props: DialogStackNextProps) => {
  const context = useContext(DialogStackContext);

  if (!context) {
    throw new Error("DialogStackNext must be used within a DialogStack");
  }

  return context.activeIndex >= context.totalDialogs - 1 ? null : (
    <div onClick={() => context.setActiveIndex(context.activeIndex + 1)} {...props} />
  );
};

export type DialogStackPreviousProps = Omit<HTMLAttributes<HTMLDivElement>, "onClick">;

export const DialogStackPrevious = (props: DialogStackPreviousProps) => {
  const context = useContext(DialogStackContext);

  if (!context) {
    throw new Error("DialogStackPrevious must be used within a DialogStack");
  }

  return context.activeIndex <= 0 ? null : (
    <div onClick={() => context.setActiveIndex(context.activeIndex - 1)} {...props} />
  );
};
