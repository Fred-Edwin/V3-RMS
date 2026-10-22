/** Leave, conduct, a casual worker and signed documents, through the real API (so the PIN, scope and audit rules apply). */
import { prisma } from '../../../config/database';
import { call, key, login, must, PIN, type Body } from './api';
import { out, type World } from './base';

const TODAY = '2026-10-21';
const inDays = (n: number): string => new Date(Date.parse(`${TODAY}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const employee = (world: World, local: string): string => {
  const id = world.employeeIds.get(local);
  if (!id) throw new Error(`no demo person ${local}`);
  return id;
};

/** Leave: a balance top-up, then requests in four states (approved twice, declined, waiting twice). */
async function leave(world: World): Promise<void> {
  await must('top up leave', 'hr', 'POST', '/workforce/leave/balances/adjust', { employeeId: employee(world, 'victor.mutua'), typeCode: 'ANNUAL', add: 3, reasonCode: 'DIRECTOR_GRANT', pin: PIN }, { 'Idempotency-Key': key('adj') });
  const ask = async (who: string, typeCode: string, start: string, end: string, reason?: string): Promise<Body> =>
    (await must(`${who} asks for leave`, who, 'POST', '/workforce/leave/applications', { typeCode, start, end, ...(reason ? { note: reason } : {}) }, { 'Idempotency-Key': key('ask') }))['application'] as Body;
  for (const who of ['susan.wafula', 'naomi.jepkorir', 'paul.odhiambo', 'beatrice.atieno', 'faith.chebet']) await login(who);

  const approved = await ask('susan.wafula', 'ANNUAL', inDays(12), inDays(16));
  await must('approve leave', 'bm.town', 'POST', `/workforce/leave/applications/${approved['id']}/approve`, { pin: PIN, expectedVersion: approved['version'] ?? 1 }, { 'Idempotency-Key': key('ap') });
  const highway = await ask('faith.chebet', 'ANNUAL', inDays(25), inDays(27));
  await must('approve leave', 'bm.highway', 'POST', `/workforce/leave/applications/${highway['id']}/approve`, { pin: PIN, expectedVersion: highway['version'] ?? 1 }, { 'Idempotency-Key': key('ap') });
  const declined = await ask('paul.odhiambo', 'ANNUAL', inDays(14), inDays(18));
  await must('decline leave', 'bm.town', 'POST', `/workforce/leave/applications/${declined['id']}/decline`, { reasonCode: 'BUSY', expectedVersion: declined['version'] ?? 1 }, { 'Idempotency-Key': key('dc') });
  const changedMind = await ask('naomi.jepkorir', 'ANNUAL', inDays(40), inDays(41));
  await must('cancel leave', 'naomi.jepkorir', 'POST', `/workforce/leave/applications/${changedMind['id']}/cancel`, {}, { 'Idempotency-Key': key('cancel') });
  await ask('naomi.jepkorir', 'ANNUAL', inDays(30), inDays(32));
  await ask('beatrice.atieno', 'EMERGENCY', inDays(3), inDays(3), 'A family matter');
  out('ok  leave: 21-day policy, one top-up, 2 approved, 1 declined, 1 cancelled, 2 waiting for a manager');
}

/** Conduct: the Branch Manager issues a written warning; the person signs it and appeals; the appeal waits for HR. */
async function conduct(world: World): Promise<void> {
  await login('isaac.kimani');
  const issued = await must('issue notice', 'bm.town', 'POST', '/workforce/conduct', { personId: employee(world, 'isaac.kimani'), level: 'WRITTEN_WARNING', about: 'BEHAVIOUR', ownLine: 'Arrived after the opening briefing twice this week without a call.', pin: PIN, idempotencyKey: key('issue') });
  await must('sign notice', 'isaac.kimani', 'POST', `/workforce/conduct/${issued['id']}/sign`, { code: PIN, deviceId: 'demo-phone-0001', idempotencyKey: key('sign') });
  await must('appeal notice', 'isaac.kimani', 'POST', `/workforce/conduct/${issued['id']}/appeal`, { reasonKey: 'TOO_STRONG', text: 'I was late once, not twice, and I rang ahead to say so.', idempotencyKey: key('appeal') });
  out('ok  conduct: one written warning, signed, with an appeal waiting for HR');
}

/** Casual pay: a rate, two casual workers added by the Kitchen head, yesterday recorded, sent, approved by the Branch Manager, one worker signs. */
async function casual(world: World): Promise<void> {
  await login('kelvin.mwai');
  const made = await must('casual rate', 'director', 'POST', '/workforce/rules/CASUAL_WORK/versions', { effectiveFrom: TODAY, values: { defaultDailyRate: '900', rates: [], pettyCashHolder: { mode: 'BRANCH_MANAGER' }, latenessReducesPayout: true }, reason: 'Demo daily rate for casual workers', pin: PIN, idempotencyKey: key('casual-rate') });
  await prisma.ruleVersion.update({ where: { id: made['version']?.id }, data: { effectiveFrom: new Date('2026-01-01T00:00:00Z') } }); // pay rates only start next month in the app; the demo needs it now (lane database only)
  const department = await prisma.department.findFirstOrThrow({ where: { siteId: world.siteIds.TOWN, key: 'KITCHEN' }, select: { id: true } });
  const person = async (fullName: string, nid: string): Promise<Body> => must('add casual', 'kelvin.mwai', 'POST', '/workforce/casuals/people', { fullName, nationalId: nid, nationalIdConfirm: nid, idempotencyKey: key('person') });
  const peter = await person('Peter Mwangi', '00000001');
  const rose = await person('Rose Wanjiru', '00000002');
  const day = inDays(-1);
  const saved = await must('record day', 'kelvin.mwai', 'PUT', '/workforce/casuals/sheets/lines', { siteId: world.siteIds.TOWN, departmentId: department.id, date: day, version: 0, idempotencyKey: key('lines'), lines: [{ casualId: peter['id'], start: '07:00', end: '15:00' }, { casualId: rose['id'], start: '10:00', end: '19:00' }] });
  const sent = await must('send sheet', 'kelvin.mwai', 'POST', `/workforce/casuals/sheets/${saved['id']}/send`, { version: saved['version'], idempotencyKey: key('send') });
  const approved = await must('approve sheet', 'bm.town', 'POST', `/workforce/casuals/sheets/${saved['id']}/approve`, { pin: PIN, version: sent['version'], expectedTotal: saved['total'], idempotencyKey: key('approve') });
  const line = (approved['lines'] as Body[]).find((l) => l['casualId'] === peter['id']);
  await must('worker signs', 'kelvin.mwai', 'POST', `/workforce/casuals/sheets/${saved['id']}/lines/${line?.['id']}/receive`, { name: 'Peter Mwangi', idempotencyKey: key('receive') });
  out(`ok  casual: two workers, ${day} approved as ${approved['number']}, one worker signed`);
}

export async function runPeopleFlows(world: World): Promise<void> {
  await leave(world);
  await conduct(world);
  await casual(world);
  const docs = await call('hr', 'GET', '/workforce/documents');
  out(`ok  documents: ${docs.status === 200 ? 'the register answers' : `register ${docs.status}`}`);
}
