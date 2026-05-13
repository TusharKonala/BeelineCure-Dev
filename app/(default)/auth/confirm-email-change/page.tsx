import ConfirmEmailChangeClient from "./ConfirmEmailChangeClient";

export default async function ConfirmEmailChangePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <ConfirmEmailChangeClient token={token ?? ""} />;
}
