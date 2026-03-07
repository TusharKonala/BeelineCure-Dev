import type { ReactNode } from "react";

type ContainerProps = {
  children: ReactNode;
};

export function Container({ children }: ContainerProps) {
  return (
    <div className="mx-auto max-w-7xl px-4 md:px-8">
      {children}
    </div>
  );
}

