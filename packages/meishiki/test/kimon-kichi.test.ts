import { describe, expect, it } from 'vitest';
import { EQUATION_OF_TIME_MINUTES, calculateKimonTonkou, findKichiHoui, fromMinutes, kichiHouiHits, kichiHouiMark, toMinutes } from '../src/index';

describe('吉方位さがし（findKichiHoui）', () => {
  const result = findKichiHoui({ start: { year: 2026, month: 11, day: 19 }, days: 7, place: '23' });

  it('7日分を返し、場所の名前を付ける', () => {
    expect(result.days).toHaveLength(7);
    expect(result.placeName).toBe('愛知県');
    expect(result.days.every((d) => !d.unavailable)).toBe(true);
  });

  it('見つけた時間は、その日に始まる2時間の刻で、時刻の順に並ぶ', () => {
    for (const day of result.days) {
      let previous = -Infinity;
      for (const slot of day.slots) {
        expect([slot.start.year, slot.start.month, slot.start.day]).toEqual([day.date.year, day.date.month, day.date.day]);
        expect(toMinutes(slot.end) - toMinutes(slot.start)).toBe(120);
        expect(toMinutes(slot.start)).toBeGreaterThan(previous);
        previous = toMinutes(slot.start);
      }
    }
  });

  it('見つけた時間は、作り直した時盤でも条件を満たす（生門70点以上か吉格、その宮に凶格なし、五不遇時でない）', () => {
    const slots = result.days.flatMap((d) => d.slots);
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      const board = calculateKimonTonkou({ type: '時盤', ...slot.boardTime, place: '23' });
      expect(board.gobuuji).toBe(false);
      expect(`${board.usedPillar.stem}${board.usedPillar.branch}`).toBe(slot.hourPillar);
      expect(slot.hits.length).toBeGreaterThan(0);
      for (const hit of slot.hits) {
        const palace = board.palaces.find((p) => p.position === hit.position)!;
        expect(palace.kyokaku).toEqual([]);
        expect(palace.position).not.toBe(5);
        if (hit.kind === '生門') {
          expect(palace.hachimon).toBe('生');
          expect(palace.score).toBeGreaterThanOrEqual(70);
          expect(hit.mark).toBe(kichiHouiMark(palace.position));
        } else {
          expect(palace.kichikaku).toContain(hit.kind);
          expect(['休', '生', '開']).toContain(palace.hachimon);
          expect(hit.mark).toBeNull();
        }
      }
    }
  });

  it('条件を満たす刻を取りこぼさない（最初の日の刻を総当たりして比べる）', () => {
    const correction = 8 + (EQUATION_OF_TIME_MINUTES[11] ?? 0); // 愛知県（経度 +8分）＋11月の均時差
    const base = toMinutes({ year: 2026, month: 11, day: 19, hour: 0, minute: 0 });
    const expected: string[] = [];
    for (let k = 0; k <= 12; k++) {
      const mid = base + k * 120 - correction;
      const start = fromMinutes(mid - 60);
      if (start.day !== 19) continue;
      const t = fromMinutes(mid);
      const board = calculateKimonTonkou({ type: '時盤', ...t, place: '23' });
      if (board.gobuuji) continue;
      const ok = board.palaces.some(
        (x) =>
          x.position !== 5 &&
          x.kyokaku.length === 0 &&
          ((x.hachimon === '生' && x.score !== null && x.score >= 70) ||
            (x.kichikaku.length > 0 && ['休', '生', '開'].includes(x.hachimon ?? ''))),
      );
      if (ok) expected.push(`${start.hour}:${start.minute}`);
    }
    expect(result.days[0]!.slots.map((s) => `${s.start.hour}:${s.start.minute}`)).toEqual(expected);
  });

  it('風遁・玉女守門も拾い、凶格のある宮・三吉門でない宮の吉格は拾わない（2026年の時盤を総当たり）', () => {
    let fuuton = 0;
    let gyokujo = 0;
    let blocked = 0;
    let notSankichi = 0;
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= 28; d++) {
        for (let h = 0; h < 24; h += 2) {
          const board = calculateKimonTonkou({ type: '時盤', year: 2026, month: m, day: d, hour: h, minute: 0, place: '23' });
          const hits = kichiHouiHits(board);
          fuuton += hits.filter((x) => x.kind === '風遁').length;
          gyokujo += hits.filter((x) => x.kind === '玉女守門').length;
          for (const p of board.palaces) {
            if (p.kichikaku.length > 0 && !['休', '生', '開'].includes(p.hachimon ?? '')) {
              notSankichi++;
              expect(hits.some((x) => x.position === p.position && x.kind !== '生門')).toBe(false);
            }
            if (p.kichikaku.length > 0 && (p.kyokaku.length > 0 || board.gobuuji)) {
              blocked++;
              expect(hits.some((x) => x.position === p.position && x.kind !== '生門')).toBe(false);
            }
          }
        }
      }
    }
    expect(fuuton).toBeGreaterThan(0);
    expect(gyokujo).toBeGreaterThan(0);
    expect(blocked).toBeGreaterThan(0);
    expect(notSankichi).toBeGreaterThan(0);
  });

  it('印：南は◎、北東・南西は◯、それ以外はなし', () => {
    expect(kichiHouiMark(9)).toBe('◎');
    expect(kichiHouiMark(8)).toBe('◯');
    expect(kichiHouiMark(2)).toBe('◯');
    expect(kichiHouiMark(1)).toBeNull();
    expect(kichiHouiMark(4)).toBeNull();
  });

  it('局数データのない年は、例外にせず unavailable にする', () => {
    const r = findKichiHoui({ start: { year: 2026, month: 12, day: 29 }, days: 7, place: '23' });
    expect(r.days.slice(0, 3).every((d) => !d.unavailable)).toBe(true);
    expect(r.days.slice(4).every((d) => d.unavailable && d.slots.length === 0)).toBe(true);
  });
});
