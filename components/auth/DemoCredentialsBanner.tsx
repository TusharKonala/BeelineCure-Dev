const demoRoles = [
  { label: "Patient", email: "tusharkonala284@gmail.com" },
  { label: "Doctor", email: "tushar.alphaink@gmail.com" },
  { label: "Admin", email: "clinivoadmin@gmail.com" },
] as const;

const demoPassword = "kanyeshade45$@";

export function DemoCredentialsBanner() {
  return (
    <div className="rounded-xl border border-[#2555F3]/20 bg-[#2555F3]/5 px-4 py-3 font-montserrat text-sm">
      <p className="font-semibold text-[#333333]">Try the demo</p>
      <p className="mt-1 text-[#5E5E5E]">
        Sign in with any account below to preview the platform as a patient,
        doctor, or admin.
      </p>
      <p className="mt-3 text-[#5E5E5E]">
        <span className="font-medium text-[#333333]">Password (all accounts):</span>{" "}
        <span className="break-all text-[#333333]">{demoPassword}</span>
      </p>
      <ul className="mt-3 space-y-2">
        {demoRoles.map((role) => (
          <li
            key={role.label}
            className="flex flex-col gap-0.5 sm:flex-row sm:gap-2"
          >
            <span className="w-16 shrink-0 font-medium text-[#333333]">
              {role.label}:
            </span>
            <span className="break-all text-[#5E5E5E]">{role.email}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
