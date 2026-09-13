"use client";

import { useEffect } from "react";
import { recordLog, type LogLevel } from "@/lib/logs";

let installed = false;

export default function LogCapture() {
  useEffect(() => {
    if (installed) return;
    installed = true;

    const methods: LogLevel[] = ["debug", "info", "warn", "error"];
    const originals = new Map<LogLevel, (...args: unknown[]) => void>();

    methods.forEach((level) => {
      const original = console[level].bind(console) as (...args: unknown[]) => void;
      originals.set(level, original);
      console[level] = ((...args: unknown[]) => {
        original(...args);
        const first = args[0];
        const message = first instanceof Error
          ? first.message
          : typeof first === "string"
            ? first
            : "Console event";
        void recordLog(level, message, args.slice(1));
      }) as typeof console[typeof level];
    });

    return () => {
      methods.forEach((level) => {
        const original = originals.get(level);
        if (original) console[level] = original as typeof console[typeof level];
      });
      installed = false;
    };
  }, []);

  return null;
}
