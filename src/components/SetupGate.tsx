"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { CircleCheck, Download, EllipsisVertical, Share, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { StepProgress } from "@/components/StepProgress";
import type { DeviceKind, DeviceSetup } from "@/hooks/useDeviceSetup";
import { buildStockAlertMessage } from "@/lib/stock";

type Step = "install" | "allow" | "blocked" | "done";

const DEVICE_LABEL: Record<DeviceKind, string> = { ios: "iPhone / iPad", android: "Android", desktop: "Computer" };

const BLOCKED_HELP: Record<DeviceKind, { title: string; path: string }> = {
  ios: { title: "On iPhone or iPad", path: "Settings › Notifications › Super Rare Tracker › turn on Allow Notifications." },
  android: { title: "On Android", path: "Press and hold the app icon › App info › Notifications › turn them on." },
  desktop: { title: "On a computer", path: "Select the icon to the left of the web address › Notifications › Allow." },
};

// The example uses the real notification wording, so it's what people will get.
const EXAMPLE_ALERT = buildStockAlertMessage("SRG#163: Wax Heads", 14);

/** Phones install first; computers and installed apps go straight to notifications. */
function stepsFor(device: DeviceKind, installed: boolean) {
  if (device === "desktop" || installed) return ["Turn on notifications", "Start tracking"];
  return [device === "ios" ? "Add to Home Screen" : "Install the app", "Turn on notifications", "Start tracking"];
}

/** The step comes from the device's state, never from a choice the person makes. */
function currentStep(device: DeviceKind, setup: DeviceSetup): Step {
  if (setup.permission === "granted") return "done";
  if (device !== "desktop" && !setup.installed) return "install";
  return setup.permission === "denied" ? "blocked" : "allow";
}

/**
 * The only screen until notifications are on: install steps for this device,
 * then the permission prompt, then a confirmation that opens the release list.
 * There's no skip, because the tracker can't do its job without alerts.
 */
export function SetupGate({
  setup,
  onFinish,
  onSendTestAlert,
}: {
  setup: DeviceSetup;
  onFinish: () => void;
  /** Sends a real push to this device; throws with a message to show if it can't. */
  onSendTestAlert: () => Promise<void>;
}) {
  // Starts from detection; the "Steps for" switch is there for when it's wrong.
  const [deviceOverride, setDeviceOverride] = useState<DeviceKind | null>(null);
  const device = deviceOverride ?? setup.device;
  const step = currentStep(device, setup);
  const steps = stepsFor(device, setup.installed);
  // Blocked counts as the "Turn on notifications" step.
  const stepIndex = step === "done" ? steps.length - 1 : step === "install" ? 0 : steps.length - 2;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-semibold tracking-tight">Get alerts before releases sell out</h1>
        <p className="m-0 text-sm text-muted-foreground">
          Super Rare Tracker sends you a notification when a release you track drops to the stock level you choose. Set it
          up once, in about a minute.
        </p>
      </div>

      {step !== "done" && (
        <div className="flex flex-wrap items-center gap-2">
          <span id="setup-device-label" className="text-xs text-muted-foreground">
            Steps for
          </span>
          <ToggleGroup
            type="single"
            spacing={0}
            value={device}
            onValueChange={(value) => value && setDeviceOverride(value as DeviceKind)}
            aria-labelledby="setup-device-label"
            className="h-11 rounded-md border border-input p-0.5 sm:h-9"
          >
            {(Object.keys(DEVICE_LABEL) as DeviceKind[]).map((kind) => (
              <ToggleGroupItem
                key={kind}
                value={kind}
                className="h-full rounded-sm! px-3 text-muted-foreground hover:text-foreground data-[state=on]:text-foreground sm:h-full"
              >
                {DEVICE_LABEL[kind]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}

      <StepProgress steps={steps} current={stepIndex} />

      <section aria-live="polite" className="flex flex-col gap-4 rounded-md border bg-card p-5 text-card-foreground">
        {step === "install" && device === "ios" && <IosInstall />}
        {step === "install" && device === "android" && <AndroidInstall setup={setup} />}
        {step === "allow" && <Allow setup={setup} />}
        {step === "blocked" && <Blocked device={device} onCheck={setup.recheckPermission} />}
        {step === "done" && <Done onFinish={onFinish} onSendTestAlert={onSendTestAlert} />}
      </section>
    </main>
  );
}

function StepHeading({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="m-0 text-lg font-semibold">{title}</h2>
      <p className="m-0 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function Instruction({ number, children }: { number: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 rounded-lg bg-muted px-3 py-2.5">
      <span aria-hidden className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
        {number}
      </span>
      <span>{children}</span>
    </li>
  );
}

const inlineIcon = "inline size-4 align-[-3px]";

function IosInstall() {
  return (
    <>
      <StepHeading title="Add the app to your Home Screen">
        iPhone and iPad only send notifications to web apps opened from the Home Screen. It’s free and there’s no App
        Store download.
      </StepHeading>
      {/* Safari can't be driven from the page, so there's no button: the step moves on when the app is opened. */}
      <ol className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
        <Instruction number={1}>
          In Safari, tap <strong>Share</strong> <Share aria-hidden className={inlineIcon} /> in the toolbar.
        </Instruction>
        <Instruction number={2}>
          Scroll down, tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
        </Instruction>
        <Instruction number={3}>
          Close Safari and open <strong>Super Rare Tracker</strong> from your Home Screen. Setup carries on there.
        </Instruction>
      </ol>
      <p className="m-0 text-xs text-muted-foreground">Already added it? Open it from your Home Screen instead of this Safari tab.</p>
    </>
  );
}

function AndroidInstall({ setup }: { setup: DeviceSetup }) {
  if (setup.installedThisVisit) {
    return (
      <StepHeading title="Open the app to carry on">
        Super Rare Tracker is installed. Open it from your home screen or app drawer, and setup carries on there.
      </StepHeading>
    );
  }

  return (
    <>
      <StepHeading title="Install the app">
        It opens full-screen from your home screen and keeps alerts reliable. It’s free and there’s no Play Store download.
      </StepHeading>
      {setup.canPromptInstall && (
        <>
          <Button className="px-4 sm:h-10" onClick={setup.promptInstall}>
            <Download aria-hidden />
            Install app
          </Button>
          <p className="m-0 text-sm text-muted-foreground">
            Your phone asks to confirm. Tap <strong className="text-foreground">Install</strong>, then open the app.
          </p>
        </>
      )}
      <div className="rounded-lg bg-muted px-3 py-2.5 text-sm">
        <p className="m-0 font-medium">{setup.canPromptInstall ? "No button, or nothing happened?" : "Install it from the browser menu"}</p>
        <p className="m-0 text-muted-foreground">
          In Chrome, tap the menu <EllipsisVertical aria-label="(three dots)" className={inlineIcon} />, then{" "}
          <strong className="text-foreground">Add to Home screen</strong> or <strong className="text-foreground">Install app</strong>.
          Already installed? Open it from your home screen.
        </p>
      </div>
    </>
  );
}

function Allow({ setup }: { setup: DeviceSetup }) {
  if (!setup.notificationsSupported) {
    return (
      <StepHeading title="This browser can’t show notifications">
        On iPhone and iPad, notifications only work once the app is added to the Home Screen. On other devices, try an
        up-to-date Chrome, Edge, Firefox or Safari.
      </StepHeading>
    );
  }

  return (
    <>
      <StepHeading title="Turn on notifications">
        Alerts are the whole point of the tracker, so the release list opens once they’re on. You’ll only hear from us
        when a release you track hits your stock level.
      </StepHeading>
      <figure className="m-0 flex flex-col gap-1.5">
        <figcaption className="text-xs font-medium text-muted-foreground">Example alert</figcaption>
        <div className="flex items-start gap-3 rounded-2xl bg-secondary p-3">
          <Image src="/logo.svg" alt="" width={36} height={36} className="size-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 text-sm">
            <div className="flex justify-between gap-2 text-xs text-muted-foreground">
              <span>Super Rare Tracker</span>
              <span>now</span>
            </div>
            <p className="m-0 font-semibold">{EXAMPLE_ALERT.title}</p>
            <p className="m-0 text-subtle-foreground">{EXAMPLE_ALERT.body}</p>
          </div>
        </div>
      </figure>
      <Button className="px-4 sm:h-10" onClick={setup.requestPermission}>
        Turn on notifications
      </Button>
      <p className="m-0 text-xs text-muted-foreground">
        Your device will ask next. Choose <strong className="text-foreground">Allow</strong>.
      </p>
    </>
  );
}

function Blocked({ device, onCheck }: { device: DeviceKind; onCheck: () => void }) {
  const help = BLOCKED_HELP[device];
  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="m-0 inline-flex items-center gap-1.5 text-xs font-semibold text-stock-warn">
          <TriangleAlert aria-hidden className="size-3.5" />
          Notifications are blocked
        </p>
        <h2 className="m-0 text-lg font-semibold">Allow notifications in your settings</h2>
        <p className="m-0 text-sm text-muted-foreground">
          Your device is blocking notifications from Super Rare Tracker, so alerts can’t reach you. Turn them on, then
          come back here.
        </p>
      </div>
      <div className="rounded-lg bg-muted px-3 py-2.5 text-sm">
        <p className="m-0 font-medium">{help.title}</p>
        <p className="m-0 text-muted-foreground">{help.path}</p>
      </div>
      <Button className="px-4 sm:h-10" onClick={onCheck}>
        Check again
      </Button>
      <p className="m-0 text-xs text-muted-foreground">This page also checks by itself when you come back to it.</p>
    </>
  );
}

function Done({ onFinish, onSendTestAlert }: { onFinish: () => void; onSendTestAlert: () => Promise<void> }) {
  const [test, setTest] = useState<{ state: "idle" | "sending" | "sent" | "failed"; message?: string }>({ state: "idle" });

  async function sendTestAlert() {
    setTest({ state: "sending" });
    try {
      await onSendTestAlert();
      setTest({ state: "sent" });
    } catch (err) {
      setTest({ state: "failed", message: err instanceof Error ? err.message : undefined });
    }
  }

  return (
    <>
      <div className="flex items-start gap-3">
        <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
          <CircleCheck className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-lg font-semibold">You’re all set</h2>
          <p className="m-0 text-sm text-muted-foreground">
            Notifications are on. Tap Track on any release and choose the stock level you want to hear about.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button className="flex-[1_1_180px] px-4 sm:h-10" onClick={onFinish}>
          Start tracking
        </Button>
        <Button
          variant="outline"
          className="flex-[1_1_160px] px-4 sm:h-10"
          onClick={sendTestAlert}
          disabled={test.state === "sending"}
        >
          {test.state === "sending" ? "Sending…" : "Send a test alert"}
        </Button>
      </div>
      {(test.state === "sent" || test.state === "failed") && (
        <p role="status" className={test.state === "sent" ? "m-0 text-sm text-success" : "m-0 text-sm text-stock-low-foreground"}>
          {test.state === "sent"
            ? "Test alert sent. It should arrive within a few seconds. Not there? Check your device’s notification settings."
            : (test.message ?? "Couldn’t send a test alert. Check your device’s notification settings, then try again.")}
        </p>
      )}
    </>
  );
}
