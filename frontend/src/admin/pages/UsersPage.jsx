import { useState } from 'react'
import { adminApi } from '../adminApi'
import Modal from '../../components/ui/Modal'
import { useAdmin } from '../AdminApp'
import { Badge, Btn, Field, Loading, Notice, PageHead, Panel, Table, dateOnly, inputCls, useLoad } from '../ui'

const ROLES = [['admin', 'Admin: everything'], ['operator', 'Operator: retry prints, cancel orders'], ['viewer', 'Viewer: read only']]

function UserForm({ user, onClose, onSaved }) {
  const [f, setF] = useState({ name: user?.name ?? '', email: user?.email ?? '', role: user?.role ?? 'operator', password: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    try {
      if (user) await adminApi.updateUser(user.id, { name: f.name, role: f.role, ...(f.password && { password: f.password }) })
      else await adminApi.createUser(f)
      onSaved()
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={user ? 'Edit staff member' : 'Add staff member'}>
      <form onSubmit={submit} className="mt-3 grid gap-3">
        <Field label="Name"><input className={inputCls} required maxLength={100} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="E-mail"><input className={inputCls} type="email" required disabled={!!user} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Role"><select className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label={user ? 'New password (leave empty to keep)' : 'Password (10+ characters)'}><input className={inputCls} type="password" autoComplete="new-password" required={!user} minLength={10} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        {user && <p className="m-0 text-xs text-[var(--muted)]">Changing the role or password signs that person out everywhere.</p>}
        {err && <Notice tone="bad">{err}</Notice>}
        <div className="flex justify-end gap-2"><Btn onClick={onClose}>Cancel</Btn><Btn variant="solid" type="submit" loading={busy}>Save</Btn></div>
      </form>
    </Modal>
  )
}

export default function UsersPage() {
  const { user: me } = useAdmin()
  const { data, loading, error, reload } = useLoad(() => adminApi.users())
  const [edit, setEdit] = useState(undefined) // undefined = closed, null = new
  const [msg, setMsg] = useState(null)
  const remove = async (u) => {
    if (!window.confirm(`Remove ${u.name}? They will be signed out and can no longer use the admin panel.`)) return
    try { await adminApi.deleteUser(u.id); reload() } catch (e) { setMsg({ tone: 'bad', text: e.message }) }
  }
  return (
    <>
      <PageHead title="Staff" sub="Who can sign in to this panel."><Btn variant="solid" onClick={() => setEdit(null)}>Add staff member</Btn></PageHead>
      {msg && <div className="mb-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      <Panel>
        {loading || error ? <Loading error={error} onRetry={reload} /> : (
          <Table rows={data} rowKey={(r) => r.id} cols={[
            { key: 'name', label: 'Name', render: (r) => <><span className="font-semibold">{r.name}</span>{r.id === me.id && <span className="ml-1 text-xs text-[var(--muted)]">(you)</span>}<span className="block text-xs text-[var(--muted)]">{r.email}</span></> },
            { key: 'role', label: 'Role', render: (r) => <Badge tone={r.role === 'admin' ? 'info' : 'mute'}>{r.role}</Badge> },
            { key: 'created_at', label: 'Added', render: (r) => dateOnly(r.created_at) },
            { key: 'act', label: '', render: (r) => <span className="flex gap-1.5"><Btn onClick={() => setEdit(r)}>Edit</Btn>{r.id !== me.id && <Btn variant="danger" onClick={() => remove(r)}>Remove</Btn>}</span> },
          ]} />
        )}
      </Panel>
      {edit !== undefined && <UserForm user={edit} onClose={() => setEdit(undefined)} onSaved={() => { setEdit(undefined); reload() }} />}
    </>
  )
}
