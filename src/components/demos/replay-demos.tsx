"use client";

import { useTranslations } from "next-intl";
import { giaPhaReplay } from "@/content/replays/gia-pha";
import { twistfitReplay } from "@/content/replays/twistfit";
import type { Locale } from "@/content/types";
import { ReplayDemo } from "./ReplayDemo";

/** Twistfit try-on: a replay (with placeholder samples until real runs are added). */
export function TwistfitReplayDemo({ locale }: { locale: Locale }) {
  return <ReplayDemo definition={twistfitReplay} kind="replay" locale={locale} />;
}

/** Gia phả AI data entry: a simulation of a feature in development. */
export function GiaPhaSimulationDemo({ locale }: { locale: Locale }) {
  const t = useTranslations("demo.giaPha");
  return (
    <ReplayDemo
      definition={giaPhaReplay}
      kind="simulation"
      locale={locale}
      footnote={<p>{t("scansPlanned")}</p>}
    />
  );
}
