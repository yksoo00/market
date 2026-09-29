"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api/auth";

interface Props {
  children: ReactNode;
  destination: string;
}

export function RedirectIfAuthenticated({ children, destination }: Props) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    void authApi.me().then((result) => {
      if (!active) return;
      if (result.ok) {
        router.replace(destination);
        return;
      }
      setChecked(true);
    });
    return () => {
      active = false;
    };
  }, [destination, router]);

  return checked ? children : null;
}
