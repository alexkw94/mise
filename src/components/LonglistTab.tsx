"use client";

import { useRef, useState } from "react";
import { Screen, ScreenHeader, ScreenScroll } from "./Screen";
import { StoredImage } from "./StoredImage";
import { storeImageFile } from "@/lib/image";
import { actions } from "@/lib/store";
import { deleteImage } from "@/lib/idb";
import type { LonglistItem } from "@/lib/types";

const VIDEO = /youtube|youtu\.be|vimeo|tiktok|instagram/i;
const IMAGE = /\.(jpg|jpeg|png|webp|heic|gif|avif)(\?|$)/i;

function kindOf(item: LonglistItem): string {
  if (item.imageId) return "Bild";
  if (!item.url) return "Notiz";
  if (VIDEO.test(item.url)) return "Video";
  if (IMAGE.test(item.url)) return "Bild";
  return "Link";
}

export function LonglistTab({ items }: { items: LonglistItem[] }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const openCount = items.filter((l) => !l.done).length;

  function add() {
    const v = input.trim();
    if (!v) return;
    const isUrl = /^https?:\/\//i.test(v);
    actions.addLonglist(isUrl ? "Link gemerkt" : v, isUrl ? v : "");
    setInput("");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const id = await storeImageFile(file, "longlist");
      actions.addLonglist(file.name.replace(/\.[^.]+$/, ""), "", id);
    } finally {
      setBusy(false);
    }
  }

  function remove(item: LonglistItem) {
    if (item.imageId) void deleteImage(item.imageId);
    actions.removeLonglist(item.id);
  }

  return (
    <Screen>
      <ScreenHeader
        kicker="Noch auszuprobieren"
        title="Merkliste"
        trailing={`${openCount} offen`}
      />

      <ScreenScroll extraBottom={20}>
        <div className="flex flex-col gap-3.5">
          <div className="flex gap-[9px]">
            <input
              className="mlk-input h-[50px] min-w-0 flex-1"
              style={{ borderRadius: 100 }}
              placeholder="Notiz oder Link einfügen"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") add();
              }}
              aria-label="Notiz oder Link"
            />
            <button
              type="button"
              onClick={add}
              disabled={!input.trim()}
              className="mlk-btn-primary h-[50px] w-[50px] flex-none p-0"
              style={{ font: "300 26px/1 var(--font-sans)" }}
              aria-label="Hinzufügen"
            >
              +
            </button>
          </div>

          <button
            type="button"
            className="mlk-btn-dashed h-[46px] px-[18px]"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            {busy ? "Lädt …" : "Bild hochladen"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFile}
          />

          <div className="mlk-card overflow-hidden">
            {items.map((item) => (
              <div
                key={item.id}
                className="mlk-row-divider flex items-start gap-[13px] px-4 py-[15px]"
              >
                <button
                  type="button"
                  onClick={() => actions.toggleLonglist(item.id)}
                  aria-pressed={item.done}
                  aria-label={item.done ? "Wieder offen" : "Erledigt"}
                  className="mt-[3px] flex h-[26px] w-[26px] flex-none cursor-pointer items-center justify-center"
                  style={{
                    borderRadius: 100,
                    border: `1px solid ${item.done ? "#1D1D1F" : "rgba(0,0,0,.2)"}`,
                    background: item.done
                      ? "linear-gradient(180deg,#4A4A4D,#1D1D1F)"
                      : "rgba(255,255,255,.7)",
                    font: "500 13px/1 var(--font-sans)",
                    color: "#fff",
                  }}
                >
                  {item.done ? "✓" : ""}
                </button>

                <div className="min-w-0 flex-1">
                  <div
                    style={{
                      font: "500 9.5px/1 var(--font-sans)",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "var(--color-faint)",
                    }}
                  >
                    {kindOf(item)}
                  </div>
                  <div
                    className="mt-1.5"
                    style={{
                      font: "400 16px/1.35 var(--font-sans)",
                      letterSpacing: "-0.016em",
                      color: item.done ? "var(--color-faint)" : "var(--color-ink)",
                      textDecoration: item.done ? "line-through" : "none",
                    }}
                  >
                    {item.note}
                  </div>

                  {item.imageId && (
                    <div
                      className="mlk-plate mt-2.5 h-[120px] w-full"
                      style={{ borderRadius: 14 }}
                    >
                      <StoredImage
                        id={item.imageId}
                        alt={item.note}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </div>
                  )}

                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mlk-truncate mt-[5px] block"
                      style={{
                        font: "400 12px/1.4 var(--font-sans)",
                        color: "var(--color-accent)",
                      }}
                    >
                      {item.url}
                    </a>
                  )}
                </div>

                <button
                  type="button"
                  className="mlk-icon-btn"
                  aria-label="Eintrag löschen"
                  onClick={() => remove(item)}
                >
                  ✕
                </button>
              </div>
            ))}

            {items.length === 0 && (
              <p
                className="px-[18px] py-[26px]"
                style={{
                  font: "400 14px/1.5 var(--font-sans)",
                  color: "var(--color-subtle)",
                }}
              >
                Nichts vorgemerkt. Wirf Videolinks, Screenshots und Ideen hier
                rein.
              </p>
            )}
          </div>
        </div>
      </ScreenScroll>
    </Screen>
  );
}
