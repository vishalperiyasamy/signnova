"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

const spokenLanguages = [
  { value: "en-us", label: "English (US)" },
  { value: "en-uk", label: "English (UK)" },
  { value: "es-es", label: "Spanish (ES)" },
  { value: "fr-fr", label: "French (FR)" },
  { value: "de-de", label: "German (DE)" },
];

const signLanguages = [
  { value: "asl", label: "ASL (American Sign Language)" },
  { value: "bsl", label: "BSL (British Sign Language)" },
  { value: "is", label: "International Sign (IS)" },
  { value: "lsl", label: "Langue des signes française (LSF)" },
];

export default function SettingsPage() {
  const [spoken, setSpoken] = useState("en-us");
  const [sign, setSign] = useState("asl");
  const [captions, setCaptions] = useState(true);
  const [highContrast, setHighContrast] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  function handleSave() {
    // Persist to localStorage for demo
    const payload = { spoken, sign, captions, highContrast, reduceMotion };
    localStorage.setItem("aurasign.settings", JSON.stringify(payload));
    alert("Settings saved locally for this demo.");
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Settings</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Language Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="spoken">Spoken Language</Label>
              <Select value={spoken} onValueChange={setSpoken}>
                <SelectTrigger id="spoken" aria-label="Select spoken language">
                  <SelectValue placeholder="Choose spoken language" />
                </SelectTrigger>
                <SelectContent>
                  {spokenLanguages.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sign">Sign Language</Label>
              <Select value={sign} onValueChange={setSign}>
                <SelectTrigger id="sign" aria-label="Select sign language">
                  <SelectValue placeholder="Choose sign language" />
                </SelectTrigger>
                <SelectContent>
                  {signLanguages.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Accessibility</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="captions">Live Captions</Label>
                <p className="text-sm text-muted-foreground">Show AI-powered captions during calls.</p>
              </div>
              <Switch id="captions" checked={captions} onCheckedChange={setCaptions} aria-label="Toggle captions" />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="contrast">High Contrast</Label>
                <p className="text-sm text-muted-foreground">Increase contrast for improved readability.</p>
              </div>
              <Switch id="contrast" checked={highContrast} onCheckedChange={setHighContrast} aria-label="Toggle high contrast" />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="motion">Reduce Motion</Label>
                <p className="text-sm text-muted-foreground">Limit animations for motion sensitivity.</p>
              </div>
              <Switch id="motion" checked={reduceMotion} onCheckedChange={setReduceMotion} aria-label="Toggle reduce motion" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Button onClick={handleSave}>Save Changes</Button>
      </div>
    </div>
  );
}