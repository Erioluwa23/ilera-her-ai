"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function AdminNavLink() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;

    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return { isAdmin: false };
        return response.json();
      })
      .then((data) => {
        if (active) setIsAdmin(data?.isAdmin === true);
      })
      .catch(() => {
        if (active) setIsAdmin(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (!isAdmin) return null;

  return (
    <Link className="pill" href="/admin" prefetch={false}>
      Admin
    </Link>
  );
}
