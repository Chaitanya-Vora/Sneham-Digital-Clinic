import { jsPDF } from 'jspdf'
import { Capacitor } from '@capacitor/core'
import type { Prescription } from './types'

const BRAND = '#41603C'
const INK = '#0F172A'
const MUTED = '#64748B'
const BORDER = '#d4d4d4'

export async function exportPrescriptionPdf(
  rx: Prescription,
  patientName: string,
  doctorName: string,
  clinicName = 'Sneham Digital Clinic',
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a5' })
  const pw = doc.internal.pageSize.getWidth()
  const margin = 14
  let y = 16

  doc.setFillColor(BRAND)
  doc.rect(0, 0, pw, 3, 'F')

  doc.setFontSize(16)
  doc.setTextColor(BRAND)
  doc.text(clinicName, margin, y)
  y += 5
  doc.setFontSize(9)
  doc.setTextColor(MUTED)
  doc.text('Healing with compassion', margin, y)
  y += 3

  doc.setDrawColor(BRAND)
  doc.setLineWidth(0.4)
  doc.line(margin, y, pw - margin, y)
  y += 8

  doc.setFontSize(9)
  doc.setTextColor(MUTED)
  const dateStr = new Date(rx.publishedAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  doc.text(`Date: ${dateStr}`, margin, y)
  doc.text(`Ref: ${rx.id.slice(0, 8).toUpperCase()}`, pw - margin, y, { align: 'right' })
  y += 7

  doc.setFontSize(9)
  doc.setTextColor(INK)
  doc.text(`Patient: ${patientName}`, margin, y)
  y += 5
  doc.text(`Prescribing doctor: ${doctorName}`, margin, y)
  y += 10

  doc.setFontSize(28)
  doc.setTextColor(BRAND)
  doc.text('℞', margin, y)
  y += 10

  doc.setDrawColor(BORDER)
  doc.setLineWidth(0.2)
  const boxTop = y - 2
  const boxW = pw - margin * 2

  doc.setFontSize(16)
  doc.setTextColor(INK)
  doc.text(rx.remedy, margin + 6, y + 4)

  doc.setFontSize(10)
  doc.setTextColor(BRAND)
  doc.text(rx.potency, margin + 6 + doc.getTextWidth(rx.remedy + '  '), y + 4)
  y += 12

  doc.setFontSize(9)
  doc.setTextColor(MUTED)
  const details = [
    `${rx.doseGlobules} globules`,
    rx.repetition,
    rx.durationDays ? `${rx.durationDays} days` : 'Until settled',
  ].join('  ·  ')
  doc.text(details, margin + 6, y)
  y += 5

  if (rx.preparation) {
    y += 2
    doc.setFontSize(8)
    doc.setTextColor(MUTED)
    const lines = doc.splitTextToSize(rx.preparation, boxW - 12)
    doc.text(lines, margin + 6, y)
    y += lines.length * 3.5
  }

  const boxBottom = y + 4
  doc.roundedRect(margin, boxTop, boxW, boxBottom - boxTop, 3, 3, 'S')
  y = boxBottom + 12

  doc.setDrawColor(BORDER)
  doc.line(margin, y, pw - margin, y)
  y += 5
  doc.setFontSize(7.5)
  doc.setTextColor(MUTED)
  doc.text(clinicName, margin, y)
  doc.text('Signature: ________________', pw - margin, y, { align: 'right' })

  const fileName = `Rx_${rx.remedy.replace(/\s/g, '_')}_${dateStr.replace(/\s/g, '')}.pdf`

  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    const base64 = doc.output('datauristring').split(',')[1]
    const written = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
    })
    await Share.share({
      title: fileName,
      url: written.uri,
    })
  } else {
    doc.save(fileName)
  }
}
