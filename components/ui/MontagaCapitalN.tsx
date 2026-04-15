import * as React from "react";

type MontagaCapitalNProps = {
  text: string;
};

const CAPITAL_N_STYLE: React.CSSProperties = {
  WebkitTextStroke: "0.1px currentColor",
};

export function MontagaCapitalN({ text }: MontagaCapitalNProps) {
  const parts = text.split("N");
  if (parts.length === 1) return <>{text}</>;

  return (
    <>
      {parts.map((part, index) => (
        <React.Fragment key={index}>
          {part}
          {index < parts.length - 1 ? <span style={CAPITAL_N_STYLE}>N</span> : null}
        </React.Fragment>
      ))}
    </>
  );
}
