import { useEffect, useState } from "react";

type BowlAudioPreviewProps = {
  audioUrl: string | null;
  bowlName: string;
};

function playableAudioUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith("ipfs://")) return trimmed;

  const path = trimmed.slice("ipfs://".length).replace(/^ipfs\//i, "");
  return `https://ipfs.io/ipfs/${path}`;
}

function createDevelopmentBowlTone(): string {
  const sampleRate = 16_000;
  const durationSeconds = 2.8;
  const sampleCount = Math.floor(sampleRate * durationSeconds);
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);

  function writeText(offset: number, value: string) {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  }

  writeText(0, "RIFF");
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, sampleCount * 2, true);

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    const attack = Math.min(1, time / 0.025);
    const decay = Math.exp(-time * 1.25);
    const tone =
      Math.sin(2 * Math.PI * 220 * time) +
      0.42 * Math.sin(2 * Math.PI * 441 * time) +
      0.18 * Math.sin(2 * Math.PI * 663 * time);
    const sample = Math.max(-1, Math.min(1, tone * attack * decay * 0.42));
    view.setInt16(44 + index * 2, Math.round(sample * 0x7fff), true);
  }

  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

export function BowlAudioPreview({ audioUrl, bowlName }: BowlAudioPreviewProps) {
  const [failed, setFailed] = useState(false);
  const [developmentAudioUrl] = useState(() =>
    import.meta.env.DEV && !audioUrl ? createDevelopmentBowlTone() : null,
  );

  useEffect(() => {
    return () => {
      if (developmentAudioUrl) URL.revokeObjectURL(developmentAudioUrl);
    };
  }, [developmentAudioUrl]);

  const source = audioUrl ? playableAudioUrl(audioUrl) : developmentAudioUrl;
  const isDevelopmentSample = !audioUrl && Boolean(developmentAudioUrl);

  return (
    <section
      aria-labelledby="bowl-audio-heading"
      style={{
        padding: 12,
        marginBottom: 16,
        border: "1px solid rgba(31, 41, 46, 0.1)",
        borderRadius: 12,
        background: "rgba(255, 255, 255, 0.45)",
      }}
    >
      <h2
        id="bowl-audio-heading"
        style={{ margin: 0, fontSize: 14, color: "var(--fg)", fontWeight: 950 }}
      >
        Listen to this bowl
      </h2>
      <p
        style={{
          margin: "4px 0 10px",
          color: "var(--muted-fg)",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {isDevelopmentSample
          ? "Development sample — the bowl's recording will replace this automatically."
          : source
            ? "Preview the sound of this individual singing bowl."
            : "Audio preview coming soon."}
      </p>

      {source ? (
        <>
          <audio
            controls
            preload="none"
            src={source}
            aria-label={`Audio preview for ${bowlName}`}
            onCanPlay={() => setFailed(false)}
            onError={() => setFailed(true)}
            style={{ display: "block", width: "100%", height: 40 }}
          />
          {failed ? (
            <p role="alert" style={{ margin: "8px 0 0", color: "crimson", fontSize: 12 }}>
              This audio preview could not be loaded. Please try again later.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
