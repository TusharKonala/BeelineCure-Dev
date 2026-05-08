import ResetPasswordClient from "./ResetPasswordClient";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; mode?: string }>;
}) {
  const { token, mode } = await searchParams;
  const resolvedMode = mode === "set" ? "set" : "reset";
  return <ResetPasswordClient token={token ?? ""} mode={resolvedMode} />;
}
