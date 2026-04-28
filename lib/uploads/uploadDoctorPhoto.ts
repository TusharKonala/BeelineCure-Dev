export async function uploadDoctorPhoto(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/uploads/doctor-photo", {
    method: "POST",
    body: formData,
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    url?: string;
  };
  if (!res.ok || !data.url) {
    throw new Error(data.error ?? "Unable to upload profile photo.");
  }
  return data.url;
}
