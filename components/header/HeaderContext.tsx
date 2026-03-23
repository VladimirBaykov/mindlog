"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
} from "react";

export type HeaderMenuItem = {
  label: string;
  onClick: () => void;
  danger?: boolean;
  highlight?: boolean;
};

type HeaderState = {
  title?: string;
  subtitle?: string;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  menuItems?: HeaderMenuItem[];
};

type HeaderContextValue = {
  header: HeaderState;
  setHeader: (state: HeaderState) => void;
  resetHeader: () => void;
};

const HeaderContext =
  createContext<HeaderContextValue | null>(null);

export function HeaderProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [header, setHeaderState] =
    useState<HeaderState>({});

  const setHeader = useCallback(
    (state: HeaderState) => {
      setHeaderState(state);
    },
    []
  );

  const resetHeader = useCallback(() => {
    setHeaderState((prev) =>
      Object.keys(prev).length === 0 ? prev : {}
    );
  }, []);

  return (
    <HeaderContext.Provider
      value={{ header, setHeader, resetHeader }}
    >
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeader() {
  const ctx = useContext(HeaderContext);

  if (!ctx)
    throw new Error(
      "useHeader must be used inside HeaderProvider"
    );

  return ctx;
}