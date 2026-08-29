import { useState, useRef, useEffect, useMemo } from 'react'
import { PaperPlaneRight, Checks } from '@phosphor-icons/react'
import { useClinic } from '../core/store'
import type { MessageSender } from '../core/types'

export function ChatThread({
  patientId,
  viewAs,
  compact,
}: {
  patientId: string
  viewAs: MessageSender
  compact?: boolean
}) {
  const messages = useClinic((s) => s.messages.filter((m) => m.patientId === patientId))
  const sendMessage = useClinic((s) => s.sendMessage)
  const markConvoRead = useClinic((s) => s.markConvoRead)
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const sorted = useMemo(
    () => [...messages].sort((a, b) => a.sentAt.localeCompare(b.sentAt)),
    [messages],
  )

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [sorted.length])

  useEffect(() => {
    const otherSender: MessageSender = viewAs === 'practitioner' ? 'patient' : 'practitioner'
    const unread = messages.some((m) => m.sender === otherSender && !m.read)
    if (unread) markConvoRead(patientId, otherSender)
  }, [patientId, messages, viewAs, markConvoRead])

  const send = () => {
    const text = draft.trim()
    if (!text) return
    sendMessage(patientId, text, viewAs)
    setDraft('')
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* chat area with WhatsApp-style subtle pattern bg */}
      <div
        className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
        style={{ backgroundColor: 'var(--color-tint-pale, #f0ebe3)', backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M30 5c1 0 2 .5 2 1.5s-1 1.5-2 1.5-2-.5-2-1.5S29 5 30 5zm15 15c1 0 2 .5 2 1.5s-1 1.5-2 1.5-2-.5-2-1.5.9-1.5 2-1.5zm-30 0c1 0 2 .5 2 1.5s-1 1.5-2 1.5-2-.5-2-1.5.9-1.5 2-1.5zm15 15c1 0 2 .5 2 1.5s-1 1.5-2 1.5-2-.5-2-1.5.9-1.5 2-1.5z\' fill=\'%23d5d0c8\' fill-opacity=\'.18\'/%3E%3C/svg%3E")' }}
      >
        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-[10px] bg-surface/80 px-5 py-3 text-[13px] text-muted shadow-sm">
              Messages are end-to-end between you and your {viewAs === 'practitioner' ? 'patient' : 'doctor'}.
            </div>
          </div>
        )}
        <div className="space-y-1">
          {sorted.map((msg) => {
            const mine = msg.sender === viewAs
            const d = new Date(msg.sentAt)
            const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            return (
              <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`relative max-w-[80%] px-3 py-1.5 shadow-sm ${
                    mine
                      ? 'rounded-[8px] rounded-tr-[2px] bg-[#d9f4d4] text-ink'
                      : 'rounded-[8px] rounded-tl-[2px] bg-surface text-body'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-[14px] leading-[1.35]">{msg.text}</p>
                  <div className={`mt-0.5 flex items-center justify-end gap-1 ${mine ? 'text-muted' : 'text-faint'}`}>
                    <span className="text-[10.5px]">{time}</span>
                    {mine && <Checks size={14} weight="bold" className={msg.read ? 'text-[#53bdeb]' : 'text-muted'} />}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div ref={endRef} />
      </div>

      {/* WhatsApp-style composer */}
      <div className="flex items-end gap-2 bg-[var(--color-tint-pale,#f0ebe3)] px-2 py-2">
        <div className="flex min-h-[42px] flex-1 items-end rounded-[22px] bg-surface px-4 py-1.5 shadow-sm">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Message"
            rows={1}
            className="max-h-[100px] flex-1 resize-none bg-transparent py-1 text-[15px] text-body outline-none placeholder:text-faint"
          />
        </div>
        <button
          onClick={send}
          disabled={!draft.trim()}
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-sm transition active:scale-95 disabled:opacity-40"
        >
          <PaperPlaneRight size={18} weight="fill" />
        </button>
      </div>
    </div>
  )
}
