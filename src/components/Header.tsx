"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

const nav = [
  { href: "/", label: "Home" },
  { href: "/interview", label: "Interview" },
  { href: "/settings", label: "Settings" },
  { href: "/about", label: "About" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
          <span className="inline-block h-8 w-8 rounded-md bg-primary" aria-hidden />
          <span className="font-semibold text-lg tracking-tight">AuraSign</span>
        </Link>

        <nav aria-label="Primary" className="hidden md:flex items-center gap-6">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
              {n.label}
            </Link>
          ))}
          <Button asChild>
            <Link href="/interview">Start Interview</Link>
          </Button>
        </nav>

        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open Menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>AuraSign</SheetTitle>
              </SheetHeader>
              <div className="mt-4 flex flex-col gap-2" role="menu" aria-label="Mobile">
                {nav.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="rounded px-2 py-2 text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {n.label}
                  </Link>
                ))}
                <Button asChild className="mt-2">
                  <Link href="/interview" onClick={() => setOpen(false)}>
                    Start Interview
                  </Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}