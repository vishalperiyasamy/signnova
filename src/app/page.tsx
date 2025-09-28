import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accessibility, Languages, Mic, Video } from "lucide-react";
import ClientErrorBoundary from "@/components/ClientErrorBoundary";

export default function HomePage() {
  return (
    <ClientErrorBoundary>
      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 pb-16 sm:pt-16 sm:pb-24">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <Badge className="mb-3">New</Badge>
              <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
                Real-time, accessible interviews for everyone
              </h1>
              <p className="mt-4 text-pretty text-muted-foreground">
                AuraSign blends WebRTC with AI captions and sign-language translation so every candidate can interview
                confidently—without communication barriers.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/interview">Start a demo interview</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/about">Learn more</Link>
                </Button>
              </div>
            </div>

            <div>
              <div className="relative aspect-video overflow-hidden rounded-xl border bg-muted">
                <video
                  className="h-full w-full object-cover"
                  controls
                  playsInline
                  poster="https://images.unsplash.com/photo-1523246191915-3c8ce3baa00b?q=80&w=1400&auto=format&fit=crop"
                >
                  <source src="https://cdn.coverr.co/videos/coverr-remote-meeting-people-in-video-call-6064/1080p.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
                <div className="pointer-events-none absolute inset-0 hidden items-end justify-end p-2 sm:flex">
                  <span className="rounded bg-background/80 px-2 py-1 text-xs text-muted-foreground ring-1 ring-border">
                    Demo: Accessibility-first UI
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-16 sm:pb-24">
          <h2 className="text-2xl font-semibold tracking-tight">Why AuraSign?</h2>
          <p className="mt-2 text-muted-foreground">Built from the ground up for inclusive hiring.</p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-5">
                <Mic className="h-5 w-5" />
                <h3 className="mt-3 font-medium">AI Live Captions</h3>
                <p className="mt-1 text-sm text-muted-foreground">Instant speech-to-text for crystal clear understanding.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <Languages className="h-5 w-5" />
                <h3 className="mt-3 font-medium">Sign Translation</h3>
                <p className="mt-1 text-sm text-muted-foreground">Bridging sign and spoken languages in real time.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <Video className="h-5 w-5" />
                <h3 className="mt-3 font-medium">Low-latency Video</h3>
                <p className="mt-1 text-sm text-muted-foreground">Reliable WebRTC stack tuned for interviews.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <Accessibility className="h-5 w-5" />
                <h3 className="mt-3 font-medium">Accessibility-first</h3>
                <p className="mt-1 text-sm text-muted-foreground">Keyboard-friendly, screen-reader aware, high contrast.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Secondary CTA */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-20">
          <div className="rounded-2xl border p-6 sm:p-10">
            <div className="grid items-center gap-6 md:grid-cols-2">
              <div>
                <h3 className="text-xl font-semibold">Experience AuraSign now</h3>
                <p className="mt-2 text-muted-foreground">
                  Launch a demo interview and try captions, sign translation placeholders, and media controls.
                </p>
              </div>
              <div className="flex justify-start md:justify-end gap-3">
                <Button asChild>
                  <Link href="/interview">Open Interview Room</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/settings">Adjust Settings</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </ClientErrorBoundary>
  );
}