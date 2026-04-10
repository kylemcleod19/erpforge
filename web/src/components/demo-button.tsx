"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DemoPickerDialog } from "./demo-picker";

export function DemoButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button className="w-full" onClick={() => setOpen(true)}>
        Try Demo
      </Button>
      <DemoPickerDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
