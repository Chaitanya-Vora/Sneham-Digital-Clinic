import { PencilSimple, Printer, CurrencyInr } from '@phosphor-icons/react'
import { Badge, Card } from '../../design-system/ui'
import { Pressable } from '../../design-system/Pressable'
import { formatDayLabel } from '../../core/day'
import type { Invoice } from '../../core/types'

const TONE = { paid: 'green', partial: 'amber', unpaid: 'amber', waived: 'neutral', cancelled: 'danger' } as const
const LABEL = { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid', waived: 'Waived', cancelled: 'Cancelled' } as const
const sum = (inv: Invoice) => inv.items.reduce((s, i) => s + i.qty * i.unitPrice, 0)

export function BillingList({ invoices, onQuickBill, onEdit, onPrint }: { invoices: Invoice[]; onQuickBill: () => void; onEdit: (inv: Invoice) => void; onPrint: (inv: Invoice) => void }) {
  const sorted = [...invoices].sort((a, b) => b.date.localeCompare(a.date) || b.invoiceNo - a.invoiceNo)
  const due = invoices.filter((i) => i.status === 'unpaid' || i.status === 'partial').reduce((s, i) => s + Math.max(0, sum(i) - i.amountReceived), 0)
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-display text-[15px] font-semibold text-ink">Billing</div>
          <div className={`text-[12.5px] ${due > 0 ? 'font-semibold text-amber-text' : 'text-muted'}`}>{due > 0 ? `₹${due.toLocaleString('en-IN')} due` : 'Nothing due'}</div>
        </div>
        <Pressable hap="tick" onClick={onQuickBill} className="flex items-center gap-1.5 rounded-pill bg-brand px-4 py-2 text-[13px] font-semibold text-screen shadow-float"><CurrencyInr size={14} weight="bold" /> Quick bill</Pressable>
      </div>
      {sorted.length === 0 ? (
        <div className="py-10 text-center text-[13px] text-muted">No invoices yet.</div>
      ) : (
        <div className="space-y-2">
          {sorted.map((inv) => {
            const cancelled = inv.status === 'cancelled'
            return (
              <Card key={inv.id} className={`flex items-center gap-3 px-3.5 py-3 ${cancelled ? 'opacity-60' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className={`font-display text-[15px] font-semibold text-ink ${cancelled ? 'line-through' : ''}`}>₹{sum(inv).toLocaleString('en-IN')} <span className="font-body text-[11.5px] font-normal text-faint">#{inv.invoiceNo}</span></div>
                  <div className="truncate text-[12px] text-muted">{formatDayLabel(inv.date)} · {inv.items[0]?.name ?? 'Consultation'}{inv.items.length > 1 ? ` +${inv.items.length - 1} more` : ''}</div>
                </div>
                <Badge tone={TONE[inv.status]}>{LABEL[inv.status]}</Badge>
                {!cancelled && <Pressable hap="tick" ariaLabel="edit invoice" onClick={() => onEdit(inv)} className="relative tap-pad flex h-8 w-8 items-center justify-center text-faint"><PencilSimple size={17} /></Pressable>}
                <Pressable hap="tick" ariaLabel="print invoice" onClick={() => onPrint(inv)} className="relative tap-pad flex h-8 w-8 items-center justify-center text-faint"><Printer size={17} /></Pressable>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
