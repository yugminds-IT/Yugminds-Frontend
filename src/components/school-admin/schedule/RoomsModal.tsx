'use client'

import { Pencil, Trash2 } from 'lucide-react'
import Modal from '../../portal/Modal'
import type { Room, RoomForm, Schedule } from './types'
import { generateBulkRoomNumbers } from './utils'

const TYPES = ['Regular Classroom', 'Science Lab', 'Computer Lab', 'Library', 'Gymnasium', 'Art Room', 'Music Room', 'Other']
const FACILITIES = ['Projector', 'Air Conditioning', 'Whiteboard', 'Smart Board', 'Computer Terminals', 'Audio System']

/** Classrooms, labs and other spaces. Add one, or a numbered run of them at once. */
export default function RoomsModal({
  open,
  rooms,
  schedules,
  form,
  setForm,
  bulk,
  setBulk,
  bulkCount,
  setBulkCount,
  editing,
  onClose,
  onCreate,
  onUpdate,
  onEdit,
  onDelete,
  onCancelEdit,
}: {
  open: boolean
  rooms: Room[]
  schedules: Schedule[]
  form: RoomForm
  setForm: (f: RoomForm) => void
  bulk: boolean
  setBulk: (v: boolean) => void
  bulkCount: string
  setBulkCount: (v: string) => void
  editing: Room | null
  onClose: () => void
  onCreate: () => void
  onUpdate: () => void
  onEdit: (r: Room) => void
  onDelete: (id: string) => void
  onCancelEdit: () => void
}) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  const count = parseInt(bulkCount, 10) || 0
  const preview = bulk && form.room_number.trim() && count >= 2 ? generateBulkRoomNumbers(form.room_number, Math.min(count, 100)) : null
  const toggle = (f: string, on: boolean) => {
    const cur = form.facilities || []
    setForm({ ...form, facilities: on ? [...cur, f] : cur.filter((x) => x !== f) })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Rooms"
      subtitle="Classrooms, labs and other spaces your classes can use."
      footer={<button className="sd-btn sd-btn--amber" onClick={onClose}>Done</button>}
    >
      <div className="sm-form">
        <section className="sm-group" aria-label="Current rooms">
          <h3 className="ts-h">Current rooms <span className="sm-muted">{rooms.length}</span></h3>
          {rooms.length === 0 ? (
            <div className="sd-empty"><b>No rooms yet</b><p>Add your first room below. Rooms are optional, but they let you catch double bookings.</p></div>
          ) : (
            <div className="ts-rooms">
              {rooms.map((r) => {
                const booked = schedules.filter((s) => s.room_id === r.id && s.day_of_week === today).length
                return (
                  <article key={r.id} className="ts-room">
                    <div>
                      <b>{r.room_number}{r.room_name ? <span className="sm-muted"> {r.room_name}</span> : null}</b>
                      <small>{r.room_type || 'Classroom'} · {r.capacity ? `${r.capacity} seats` : 'No capacity set'}{r.location ? ` · ${r.location}` : ''}</small>
                      {(r.facilities ?? []).length > 0 && <div className="tm-chips">{(r.facilities ?? []).slice(0, 3).map((f) => <span key={f} className="sm-chip">{f}</span>)}{(r.facilities ?? []).length > 3 && <span className="sm-chip">+{(r.facilities ?? []).length - 3}</span>}</div>}
                    </div>
                    <div className="ts-room-side">
                      {booked > 0 && <span className="sm-chip" data-class="true">{booked} today</span>}
                      <span className="sm-chip" data-on={r.is_active}>{r.is_active ? 'Active' : 'Off'}</span>
                      <span className="sm-acts">
                        <button className="pl-ico" onClick={() => onEdit(r)} aria-label={`Edit room ${r.room_number}`} title="Edit"><Pencil /></button>
                        <button className="pl-ico nt-del" onClick={() => onDelete(r.id)} aria-label={`Delete room ${r.room_number}`} title="Delete"><Trash2 /></button>
                      </span>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section className="sm-group" aria-label={editing ? 'Edit room' : 'Add a room'}>
          <div className="ts-roomhead">
            <h3 className="ts-h">{editing ? `Edit room ${editing.room_number}` : 'Add a room'}</h3>
            {!editing && (
              <label className="ts-check"><input type="checkbox" className="sm-check" checked={bulk} onChange={(e) => setBulk(e.target.checked)} />Add several at once</label>
            )}
          </div>
          <div className="sm-two">
            <div className="sd-field-wrap">
              <label htmlFor="rf-num">{bulk ? 'First room number' : 'Room number'}</label>
              <input id="rf-num" className="sd-field" placeholder="R101" value={form.room_number} onChange={(e) => setForm({ ...form, room_number: e.target.value })} />
            </div>
            {bulk ? (
              <div className="sd-field-wrap">
                <label htmlFor="rf-count">How many</label>
                <input id="rf-count" type="number" min={2} max={100} className="sd-field" placeholder="5" value={bulkCount} onChange={(e) => setBulkCount(e.target.value)} />
              </div>
            ) : (
              <div className="sd-field-wrap">
                <label htmlFor="rf-name">Name <small className="sm-opt">optional</small></label>
                <input id="rf-name" className="sd-field" placeholder="Science lab" value={form.room_name} onChange={(e) => setForm({ ...form, room_name: e.target.value })} />
              </div>
            )}
          </div>
          {bulk && (
            <p className="as-fine" style={{ margin: 0 }}>
              {preview ? <>Will create <b>{preview[0]}</b>, {preview[1]}{preview.length > 2 ? <>, …, <b>{preview[preview.length - 1]}</b></> : null}. They share the type, capacity, location and facilities below.</> : 'Rooms are numbered in a run from the first number. They share the details below.'}
            </p>
          )}
          <div className="sm-two">
            <div className="sd-field-wrap">
              <label htmlFor="rf-type">Type</label>
              <select id="rf-type" className="sd-field" value={form.room_type || 'Regular Classroom'} onChange={(e) => setForm({ ...form, room_type: e.target.value })}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="sd-field-wrap">
              <label htmlFor="rf-cap">Seats <small className="sm-opt">optional</small></label>
              <input id="rf-cap" type="number" className="sd-field" placeholder="30" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </div>
          </div>
          <div className="sd-field-wrap">
            <label htmlFor="rf-loc">Location <small className="sm-opt">optional</small></label>
            <input id="rf-loc" className="sd-field" placeholder="First floor" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div className="sd-field-wrap">
            <label>Facilities</label>
            <div className="as-chips" role="group" aria-label="Facilities">
              {FACILITIES.map((f) => {
                const on = (form.facilities || []).includes(f)
                return <button key={f} type="button" className="as-chip" aria-pressed={on} onClick={() => toggle(f, !on)}>{f}</button>
              })}
            </div>
          </div>
          <div className="sd-hero-actions" style={{ marginTop: 0 }}>
            {editing && <button className="sd-btn sd-btn--line" onClick={onCancelEdit}>Cancel</button>}
            <button className="sd-btn sd-btn--amber" onClick={editing ? onUpdate : onCreate}>
              {editing ? 'Save changes' : bulk ? `Add ${count || ''} rooms` : 'Add room'}
            </button>
          </div>
        </section>
      </div>
    </Modal>
  )
}
