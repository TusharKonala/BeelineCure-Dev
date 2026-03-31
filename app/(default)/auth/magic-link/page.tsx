import MagicLinkClient from "./MagicLinkClient";

export default async function MagicLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; callbackUrl?: string }>;
}) {
  const { token, callbackUrl } = await searchParams;
  return (
    <MagicLinkClient
      token={token ?? ""}
      callbackUrlRaw={callbackUrl ?? "/patient/dashboard"}
    />
  );
}
