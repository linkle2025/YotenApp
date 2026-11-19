import { describe, expect, it } from 'vitest';
import { EQUATION_OF_TIME_MINUTES, calculateKimonTonkou, findKichiHoui, fromMinutes, kichiHouiMark, toMinutes } from '../src/index';

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

  it('見つけた時間は、作り直した時盤でも条件（生門70点以上・凶格なし・五不遇時でない）を満たす', () => {
    const slots = result.days.flatMap((d) => d.slots);
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      const board = calculateKimonTonkou({ type: '時盤', ...slot.boardTime, place: '23' });
      expect(board.gobuuji).toBe(false);
      const palace = board.palaces.find((p) => p.hachimon === '生')!;
      expect(palace.position).toBe(slot.position);
      expect(palace.score).toBe(slot.score);
      expect(palace.score).toBeGreaterThanOrEqual(70);
      expect(palace.kyokaku).toEqual([]);
      expect(`${board.usedPillar.stem}${board.usedPillar.branch}`).toBe(slot.hourPillar);
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
      const p = board.palaces.find((x) => x.hachimon === '生');
      if (!board.gobuuji && p && p.score !== null && p.score >= 70 && p.kyokaku.length === 0) {
        expected.push(`${start.hour}:${start.minute}`);
      }
    }
    expect(result.days[0]!.slots.map((s) => `${s.start.hour}:${s.start.minute}`)).toEqual(expected);
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
