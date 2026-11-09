/**
 * 出生地（都道府県）と時刻補正
 * 現行: backend/apps/fortune/calculators.py 41-109
 *
 * 補正には県庁所在地の値を使う。現行の都市名（札幌・浦和など）は `legacyCity` に残し、
 * 現行版との比較テストに使う。
 */

export interface Prefecture {
  /** JIS 都道府県コード（01〜47） */
  code: string;
  name: string;
  /** 補正に使う県庁所在地（現行の都市名） */
  legacyCity: string;
  /** 標準時（東経135度）との経度差による補正（分） */
  longitudeOffsetMinutes: number;
}

export const PREFECTURES: readonly Prefecture[] = [
  { code: '01', name: '北海道', legacyCity: '札幌', longitudeOffsetMinutes: 25 },
  { code: '02', name: '青森県', legacyCity: '青森', longitudeOffsetMinutes: 23 },
  { code: '03', name: '岩手県', legacyCity: '盛岡', longitudeOffsetMinutes: 25 },
  { code: '04', name: '宮城県', legacyCity: '仙台', longitudeOffsetMinutes: 24 },
  { code: '05', name: '秋田県', legacyCity: '秋田', longitudeOffsetMinutes: 20 },
  { code: '06', name: '山形県', legacyCity: '山形', longitudeOffsetMinutes: 21 },
  { code: '07', name: '福島県', legacyCity: '福島', longitudeOffsetMinutes: 22 },
  { code: '08', name: '茨城県', legacyCity: '水戸', longitudeOffsetMinutes: 22 },
  { code: '09', name: '栃木県', legacyCity: '宇都宮', longitudeOffsetMinutes: 20 },
  { code: '10', name: '群馬県', legacyCity: '前橋', longitudeOffsetMinutes: 16 },
  { code: '11', name: '埼玉県', legacyCity: '浦和', longitudeOffsetMinutes: 19 },
  { code: '12', name: '千葉県', legacyCity: '千葉', longitudeOffsetMinutes: 20 },
  { code: '13', name: '東京都', legacyCity: '東京', longitudeOffsetMinutes: 19 },
  { code: '14', name: '神奈川県', legacyCity: '横浜', longitudeOffsetMinutes: 19 },
  { code: '15', name: '新潟県', legacyCity: '新潟', longitudeOffsetMinutes: 16 },
  { code: '16', name: '富山県', legacyCity: '富山', longitudeOffsetMinutes: 9 },
  { code: '17', name: '石川県', legacyCity: '金沢', longitudeOffsetMinutes: 7 },
  { code: '18', name: '福井県', legacyCity: '福井', longitudeOffsetMinutes: 5 },
  { code: '19', name: '山梨県', legacyCity: '甲府', longitudeOffsetMinutes: 14 },
  { code: '20', name: '長野県', legacyCity: '長野', longitudeOffsetMinutes: 13 },
  { code: '21', name: '岐阜県', legacyCity: '岐阜', longitudeOffsetMinutes: 7 },
  { code: '22', name: '静岡県', legacyCity: '静岡', longitudeOffsetMinutes: 14 },
  { code: '23', name: '愛知県', legacyCity: '名古屋', longitudeOffsetMinutes: 8 },
  { code: '24', name: '三重県', legacyCity: '津', longitudeOffsetMinutes: 6 },
  { code: '25', name: '滋賀県', legacyCity: '大津', longitudeOffsetMinutes: 3 },
  { code: '26', name: '京都府', legacyCity: '京都', longitudeOffsetMinutes: 3 },
  { code: '27', name: '大阪府', legacyCity: '大阪', longitudeOffsetMinutes: 2 },
  { code: '28', name: '兵庫県', legacyCity: '神戸', longitudeOffsetMinutes: 1 },
  { code: '29', name: '奈良県', legacyCity: '奈良', longitudeOffsetMinutes: 3 },
  { code: '30', name: '和歌山県', legacyCity: '和歌山', longitudeOffsetMinutes: 1 },
  { code: '31', name: '鳥取県', legacyCity: '鳥取', longitudeOffsetMinutes: -3 },
  { code: '32', name: '島根県', legacyCity: '松江', longitudeOffsetMinutes: -8 },
  { code: '33', name: '岡山県', legacyCity: '岡山', longitudeOffsetMinutes: -4 },
  { code: '34', name: '広島県', legacyCity: '広島', longitudeOffsetMinutes: -10 },
  { code: '35', name: '山口県', legacyCity: '山口', longitudeOffsetMinutes: -14 },
  { code: '36', name: '徳島県', legacyCity: '徳島', longitudeOffsetMinutes: -2 },
  { code: '37', name: '香川県', legacyCity: '高松', longitudeOffsetMinutes: -9 },
  { code: '38', name: '愛媛県', legacyCity: '松山', longitudeOffsetMinutes: -9 },
  { code: '39', name: '高知県', legacyCity: '高知', longitudeOffsetMinutes: -6 },
  { code: '40', name: '福岡県', legacyCity: '福岡', longitudeOffsetMinutes: -18 },
  { code: '41', name: '佐賀県', legacyCity: '佐賀', longitudeOffsetMinutes: -19 },
  { code: '42', name: '長崎県', legacyCity: '長崎', longitudeOffsetMinutes: -21 },
  { code: '43', name: '熊本県', legacyCity: '熊本', longitudeOffsetMinutes: -18 },
  { code: '44', name: '大分県', legacyCity: '大分', longitudeOffsetMinutes: -14 },
  { code: '45', name: '宮崎県', legacyCity: '宮崎', longitudeOffsetMinutes: -14 },
  { code: '46', name: '鹿児島県', legacyCity: '鹿児島', longitudeOffsetMinutes: -18 },
  { code: '47', name: '沖縄県', legacyCity: '那覇', longitudeOffsetMinutes: -29 },
];

const BY_CODE = new Map(PREFECTURES.map((p) => [p.code, p]));
const BY_LEGACY_CITY = new Map(PREFECTURES.map((p) => [p.legacyCity, p]));

export function getPrefecture(code: string): Prefecture {
  const prefecture = BY_CODE.get(code);
  if (!prefecture) {
    throw new RangeError(`不正な都道府県コードです: ${code}`);
  }
  return prefecture;
}

/** 現行の都市名（札幌・浦和など）から都道府県を引く。現行データとの比較用 */
export function prefectureFromLegacyCity(city: string): Prefecture {
  const prefecture = BY_LEGACY_CITY.get(city);
  if (!prefecture) {
    throw new RangeError(`不正な都市名です: ${city}`);
  }
  return prefecture;
}

/** 月ごとの均時差（分）。月は入力した生月（補正前）で引く */
export const EQUATION_OF_TIME_MINUTES: Readonly<Record<number, number>> = {
  1: -3,
  2: -13,
  3: -12,
  4: -4,
  5: 3,
  6: 2,
  7: -3,
  8: -6,
  9: 0,
  10: 10,
  11: 16,
  12: 11,
};
