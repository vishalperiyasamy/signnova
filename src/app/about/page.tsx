"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">About AuraSign</h1>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Our Mission</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              AuraSign is an AI-powered, real-time accessible interview platform. Our mission is to make hiring
              inclusive by bridging communication between spoken and sign languages with instant captioning and
              translation.
            </p>
            <p>
              We believe accessibility is a fundamental right. By centering deaf and hard-of-hearing candidates and
              interviewers, we build tools that reduce friction and bias in the interview process.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Technology</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-muted-foreground">
            <ul className="list-disc pl-5">
              <li>Low-latency WebRTC video stack</li>
              <li>AI-driven live captions and translations</li>
              <li>Accessible UI with keyboard-first interactions</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Team</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-muted-foreground">
            <p>We are a multidisciplinary team of engineers, designers, and advocates for accessibility.</p>
            <p>Want to collaborate? Reach out to us.</p>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Impact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-muted-foreground">
            <p>
              Companies using AuraSign report higher candidate satisfaction and clearer communication across teams.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}