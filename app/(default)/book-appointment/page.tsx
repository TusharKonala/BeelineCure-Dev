import { BookingStepsSection } from "./components/BookingStepsSection";
import { DoctorSelectionSection } from "./components/DoctorSelectionSection";
import { HeaderSection } from "./components/HeaderSection";

export default function BookAppointmentPage() {
  return (
    <>
      <HeaderSection />
      <DoctorSelectionSection />
      <BookingStepsSection />
    </>
  );
}
