"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type MainMenuProps = {
  isAdmin?: boolean;
};

const menuItems = [
  { href: "/partidas", label: "Partidas", adminOnly: false },
  { href: "/ranking", label: "Ranking", adminOnly: false },
  { href: "/participantes", label: "Participantes", adminOnly: true },
  { href: "/manual", label: "Manual", adminOnly: false },
];

export function MainMenu({ isAdmin = false }: MainMenuProps) {
  const pathname = usePathname();

  return (
    <nav className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      <ul className="flex flex-wrap gap-2">
        {menuItems
          .filter((item) => !item.adminOnly || isAdmin)
          .map((item) => {
            const active = item.href === "/partidas" ? pathname === "/" || pathname.startsWith("/partidas") : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`inline-flex rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    active ? "bg-[#17346b] text-white" : "bg-[#eef3f9] text-[#17346b] hover:bg-[#dce9f7]"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
      </ul>
    </nav>
  );
}
