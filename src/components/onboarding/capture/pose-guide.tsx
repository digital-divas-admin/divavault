"use client";

interface PoseGuideProps {
  type: "face_oval" | "upper_body" | "full_body";
}

export function PoseGuide({ type }: PoseGuideProps) {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      <svg
        viewBox="0 0 300 400"
        className="w-full h-full max-w-[80%] max-h-[80%] opacity-30"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeDasharray="8 4"
      >
        {type === "face_oval" && (
          <ellipse cx="150" cy="160" rx="80" ry="100" />
        )}

        {type === "upper_body" && (
          <>
            {/* Head */}
            <ellipse cx="150" cy="80" rx="45" ry="55" />
            {/* Shoulders */}
            <path d="M 70 160 Q 90 140 150 135 Q 210 140 230 160" />
            {/* Body outline */}
            <path d="M 70 160 L 70 320 L 230 320 L 230 160" />
          </>
        )}

        {type === "full_body" && (
          <>
            {/* Head */}
            <ellipse cx="150" cy="50" rx="30" ry="38" />
            {/* Body */}
            <path d="M 100 100 Q 110 88 150 85 Q 190 88 200 100" />
            <path d="M 100 100 L 100 240 L 200 240 L 200 100" />
            {/* Legs */}
            <path d="M 110 240 L 110 380" />
            <path d="M 190 240 L 190 380" />
          </>
        )}
      </svg>
    </div>
  );
}
