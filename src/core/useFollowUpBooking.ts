import { useClinic } from './store'
import { addDaysISO, firstAvailableMorningSlot, todayISO } from './day'
import { followUpDateLabel, rememberFollowUpDays } from './followUpChoice'
import { haptic } from '../design-system/haptics'
import { useToast } from '../design-system/toast'
import type { Patient } from './types'

// One way to book "the next visit in N days" from a recall-queue card — shared by
// the phone's Follow-ups tab and the web console's Follow-ups page, so both book
// the same slot, say the same thing, and Undo the same way: the booking is
// cancelled and the patient's "Follow-up scheduled" notice is taken back.
export function useBookFollowUp() {
  const appointments = useClinic((s) => s.appointments)
  const me = useClinic((s) => s.currentPractitionerId)
  const scheduleFollowUp = useClinic((s) => s.scheduleFollowUp)
  const updateAppointmentStatus = useClinic((s) => s.updateAppointmentStatus)
  const dismissNotification = useClinic((s) => s.dismissNotification)
  const toast = useToast()

  return (patient: Patient, days: number) => {
    const date = addDaysISO(todayISO(), days)
    const time = firstAvailableMorningSlot(appointments, date)
    const { appointmentId, notificationId } = scheduleFollowUp({
      patientId: patient.id,
      practitionerId: patient.owningPractitionerId ?? me,
      time, date, type: 'In person', reason: 'Follow-up',
    })
    rememberFollowUpDays(days)
    haptic('success')
    toast({
      title: `Booked · ${followUpDateLabel(date)}`,
      message: `${patient.name} · ${time}`,
      action: {
        label: 'Undo',
        onClick: () => { updateAppointmentStatus(appointmentId, 'Cancelled'); dismissNotification(notificationId) },
      },
    })
  }
}
