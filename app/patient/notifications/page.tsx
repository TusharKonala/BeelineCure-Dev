import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Container } from "@/components/layout/Container";

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export default async function PatientNotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/patient/notifications");
  }

  const userId = session.user.id;
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="w-full bg-[#fafafa] py-6 md:py-8">
      <Container>
        <section className="rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1
                style={{
                  WebkitTextStroke: "0.08px #333333",
                  WebkitTextFillColor: "#333333",
                }}
                className="font-montaga text-2xl font-semibold leading-tight text-[#333333] md:text-3xl"
              >
                Notifications
              </h1>
              <p className="mt-2 font-montserrat text-sm text-[#5E5E5E]">
                Updates about booked, rescheduled, cancelled, and upcoming appointments.
              </p>
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="mt-8 rounded-xl border border-dashed border-[#e5e5e5] bg-[#fcfcfc] p-8 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#f5f5f5] text-[#5E5E5E]">
                <Bell className="size-5" aria-hidden />
              </div>
              <p className="mt-3 font-montserrat text-sm font-semibold text-[#333333]">
                No notifications yet
              </p>
              <p className="mt-1 font-montserrat text-sm text-[#5E5E5E]">
                Appointment updates will appear here.
              </p>
            </div>
          ) : (
            <ul className="mt-8 space-y-3">
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  className="rounded-xl border border-[#e5e5e5] bg-white p-4 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-montserrat text-sm font-semibold text-[#333333]">
                        {notification.title}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap font-montserrat text-sm leading-relaxed text-[#5E5E5E]">
                        {notification.message}
                      </p>
                    </div>
                    <time className="shrink-0 whitespace-nowrap font-montserrat text-xs text-[#9A9A9A]">
                      {formatDateTime(notification.createdAt)}
                    </time>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Container>
    </div>
  );
}
