import { type FormEvent } from 'react';
import { Card, Feedback, Field, metric, money, useHub } from './shared.tsx';

type Lot = { target: number; wanted: string; final: boolean; leader: boolean; declared: number; verified: number; rate: number | null; transport: number | null; entries: {
  user_id: number; name: string; declared: number; verified: number | null; grade: string | null; due: number | null; transport_share: number | null; self: boolean;
}[] };

type Roster = { id: number; name: string; self: boolean }[];
type Props = { roster?: Roster; circle: number; version: number; busy: boolean; update: (path: string, data: unknown, final?: boolean) => void };
export function LotPanel({ circle, version, busy, roster, update }: Props) {
  const path = `/circles/${circle}/lot`;
  const data = useHub<Lot>(path, version, 12000);
  const lot = data?.data;
  const pending = roster?.filter(member => !lot?.entries.some(row => row.user_id === member.id));
  const own = lot?.entries.find(row => row.self);
  function submit(event: FormEvent<HTMLFormElement>, action: (fields: FormData) => void) {
    event.preventDefault();
    action(new FormData(event.currentTarget));
  }
  return <Card title="দলীয় সংগ্রহ ও চূড়ান্ত লট">
    <Feedback error={data?.error} pending={!data}/>
    {lot && <>
      <div className="fh-summary">
        <div><span>লক্ষ্য</span><strong>{metric(lot.target)} কেজি</strong></div>
        <div><span>সদস্যদের ঘোষিত</span><strong>{metric(lot.declared)} কেজি</strong></div>
        <div><span>যাচাই হয়েছে</span><strong>{metric(lot.verified)} কেজি</strong></div>
      </div>
      <p>{lot.final ? 'চূড়ান্ত লট প্রস্তুত' : 'সংগ্রহ চলছে'}{lot.wanted && ` · চাহিদার নোট: ${lot.wanted}`}</p>
      {!lot.final && <form className="fh-actions" onSubmit={e => submit(e, f => update(path, { weight: Number(f.get('weight')) }))}>
        <Field label="আমার ফসল (কেজি)"><input type="number" name="weight" required min="1" max="10000000"
          defaultValue={lot.entries.find(x => x.self)?.declared}/></Field>
        <button type="submit" disabled={busy}>ওজন জমা দিন</button>
      </form>}
      {lot.final && own?.due != null && <div className="gs-demand"><strong>আপনার সম্ভাব্য পাওনা {money(own.due)}</strong><p>যাচাইকৃত {metric(own.verified)} কেজি · পরিবহন ভাগ {money(own.transport_share)}</p></div>}
      {lot.entries.map(row => <div className="fh-row" key={row.user_id}>
        <div><strong>{row.name}</strong><p>ঘোষিত {metric(row.declared)} · যাচাইকৃত {metric(row.verified)} কেজি{row.grade && ` · গ্রেড ${row.grade}`}</p>
        {row.due != null && <p>পরিবহন ভাগ {money(row.transport_share)} · সম্ভাব্য পাওনা {money(row.due)}</p>}</div>
        {!lot.final && lot.leader && <form className="fh-actions" onSubmit={e => submit(e, f => update(`${path}/${row.user_id}`, { weight: Number(f.get('weight')), grade: f.get('grade') }))}>
          <Field label="যাচাইকৃত ওজন (কেজি)"><input type="number" name="weight" required min="1" max="10000000" defaultValue={row.verified ?? row.declared}/></Field>
          <Field label="মান / গ্রেড"><input name="grade" required maxLength={120} defaultValue={row.grade ?? ''}/></Field>
          <button type="submit" disabled={busy}>যাচাই সেভ করুন</button>
        </form>}
      </div>)}
      {!!pending?.length && <details><summary>ওজন জমা দেননি · {metric(pending.length)} জন</summary>
        <ul>{pending.map(member => <li key={member.id}>{member.name}{member.self && ' · আপনি'}</li>)}</ul></details>}
      {lot.final ? <p>হিসাবের দর {money(lot.rate)}/কেজি · মোট পরিবহন {money(lot.transport)}</p>
        : lot.leader && <form className="fh-stack" onSubmit={e => submit(e, f => {
          if (window.confirm('সব তথ্য যাচাই করে লট চূড়ান্ত করবেন?')) update(`${path}/final`, { rate: f.get('rate'), transport: f.get('transport') }, true);
        })}>
          <div className="fh-fields"><Field label="লটের হিসাবের দর (৳/কেজি)"><input name="rate" type="number" min=".01" max="100000" step=".01" required/></Field>
          <Field label="মোট পরিবহন (৳)"><input name="transport" type="number" min="0" max="100000000" step=".01" required defaultValue="0"/></Field></div>
          <p className="fh-muted">একই দর সব ওজনে প্রযোজ্য। ওজনের অনুপাতে পরিবহন খরচ ভাগ হবে।</p>
          <button className="fh-primary" type="submit" disabled={busy || lot.verified === 0 || lot.entries.some(row => row.verified == null)}>লট চূড়ান্ত করুন</button>
        </form>}
    </>}
  </Card>;
}
