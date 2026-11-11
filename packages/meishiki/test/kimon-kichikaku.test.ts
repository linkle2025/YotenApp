import { describe, expect, it } from 'vitest';
import { calculateKimonTonkou, judgeKichikaku, type KimonResult } from '../src';

describe('吉格の判定（judgeKichikaku）', () => {
  it('風遁：巽宮（4）に天盤の乙と三吉門', () => {
    for (const mon of ['休', '生', '開'] as const) {
      expect(judgeKichikaku({ position: 4, tenbanKan: ['乙'], hachimon: mon, chokushiPosition: 1 })).toEqual(['風遁']);
    }
    expect(judgeKichikaku({ position: 4, tenbanKan: ['乙'], hachimon: '景', chokushiPosition: 1 })).toEqual([]);
    expect(judgeKichikaku({ position: 9, tenbanKan: ['乙'], hachimon: '休', chokushiPosition: 1 })).toEqual([]);
    expect(judgeKichikaku({ position: 4, tenbanKan: ['丙'], hachimon: '休', chokushiPosition: 1 })).toEqual([]);
  });

  it('玉女守門：天盤の丁が直使と同じ宮', () => {
    expect(judgeKichikaku({ position: 7, tenbanKan: ['丁'], hachimon: '驚', chokushiPosition: 7 })).toEqual(['玉女守門']);
    expect(judgeKichikaku({ position: 7, tenbanKan: ['丁'], hachimon: '驚', chokushiPosition: 6 })).toEqual([]);
  });

  it('天盤干が2つある宮は、2つ目の干も見る。両方そろえば両方', () => {
    expect(judgeKichikaku({ position: 4, tenbanKan: ['丙', '乙'], hachimon: '開', chokushiPosition: 1 })).toEqual(['風遁']);
    expect(judgeKichikaku({ position: 4, tenbanKan: ['乙', '丁'], hachimon: '生', chokushiPosition: 4 })).toEqual(['風遁', '玉女守門']);
  });
});

describe('2026年の時盤で、条件どおりに吉格が付く', () => {
  const boards: KimonResult[] = [];
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= 28; d += 3) {
      for (let h = 0; h < 24; h += 2) boards.push(calculateKimonTonkou({ type: '時盤', year: 2026, month: m, day: d, hour: h }));
    }
  }

  it('風遁・玉女守門の宮は、それぞれの条件を満たし、満たす宮にはすべて付いている', () => {
    let fuuton = 0;
    let gyokujo = 0;
    for (const b of boards) {
      for (const p of b.palaces) {
        const isFuuton = p.position === 4 && p.tenbanKan.includes('乙') && ['休', '生', '開'].includes(p.hachimon ?? '');
        const isGyokujo = p.position === b.detail.chokushi.position && p.tenbanKan.includes('丁');
        expect(p.kichikaku.includes('風遁')).toBe(isFuuton);
        expect(p.kichikaku.includes('玉女守門')).toBe(isGyokujo);
        if (isFuuton) fuuton++;
        if (isGyokujo) gyokujo++;
      }
    }
    // どちらも実際の盤に現れる（判定が死んでいない）
    expect(fuuton).toBeGreaterThan(0);
    expect(gyokujo).toBeGreaterThan(0);
  });
});
