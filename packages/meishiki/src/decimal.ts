/**
 * 10進数の固定小数点演算（鑑定スキル表用）
 *
 * 現行の Python 版は Decimal(str(値)) で計算し、ROUND_HALF_UP で四捨五入している。
 * JavaScript の number では 0.6 × 12.5 などで誤差が出て、四捨五入の結果が変わることがあるため、
 * 小数点以下12桁の整数（BigInt）で計算する。入力は五行の点数（0.25 刻みなど）と設定ファイルの数値（小数数桁）
 * なので、掛け算の結果も12桁以内に収まり、誤差なく計算できる。
 */

const SCALE_DIGITS = 12;
const SCALE = 10n ** BigInt(SCALE_DIGITS);

export class Dec {
  private constructor(private readonly units: bigint) {}

  static readonly ZERO = new Dec(0n);

  /** 数値（または数値の文字列）から作る。number は最短の10進表記（Python の str と同じ）を経由する */
  static from(value: number | string | Dec): Dec {
    if (value instanceof Dec) return value;
    const text = typeof value === 'number' ? numberToPlainString(value) : value.trim();
    const match = /^([+-])?(\d+)(?:\.(\d+))?$/.exec(text);
    if (!match) throw new RangeError(`数値に変換できません: ${value}`);
    const [, sign, intPart, fracPart = ''] = match;
    if (fracPart.length > SCALE_DIGITS) throw new RangeError(`小数点以下の桁が多すぎます: ${value}`);
    const units = BigInt(intPart!) * SCALE + BigInt(fracPart.padEnd(SCALE_DIGITS, '0') || '0');
    return new Dec(sign === '-' ? -units : units);
  }

  add(other: Dec): Dec {
    return new Dec(this.units + other.units);
  }

  sub(other: Dec): Dec {
    return new Dec(this.units - other.units);
  }

  mul(other: Dec): Dec {
    // 想定する入力では割り切れる。割り切れない場合（12桁を超える）は12桁目で四捨五入する
    const product = this.units * other.units;
    const negative = product < 0n;
    const abs = negative ? -product : product;
    let q = abs / SCALE;
    if ((abs % SCALE) * 2n >= SCALE) q += 1n;
    return new Dec(negative ? -q : q);
  }

  cmp(other: Dec): number {
    return this.units < other.units ? -1 : this.units > other.units ? 1 : 0;
  }

  isZero(): boolean {
    return this.units === 0n;
  }

  static max(a: Dec, b: Dec): Dec {
    return a.cmp(b) >= 0 ? a : b;
  }

  static min(a: Dec, b: Dec): Dec {
    return a.cmp(b) <= 0 ? a : b;
  }

  static sum(values: Iterable<Dec>): Dec {
    let total = Dec.ZERO;
    for (const v of values) total = total.add(v);
    return total;
  }

  /** 四捨五入（0.5 は0から遠い方へ。Python の ROUND_HALF_UP と同じ）して整数にする */
  roundHalfUp(): number {
    const negative = this.units < 0n;
    const abs = negative ? -this.units : this.units;
    let int = abs / SCALE;
    if ((abs % SCALE) * 2n >= SCALE) int += 1n;
    return Number(negative ? -int : int);
  }

  toNumber(): number {
    return Number(this.toString());
  }

  toString(): string {
    const negative = this.units < 0n;
    const abs = negative ? -this.units : this.units;
    const int = abs / SCALE;
    const frac = (abs % SCALE).toString().padStart(SCALE_DIGITS, '0').replace(/0+$/, '');
    return `${negative ? '-' : ''}${int}${frac ? `.${frac}` : ''}`;
  }
}

function numberToPlainString(value: number): string {
  if (!Number.isFinite(value)) throw new RangeError(`数値ではありません: ${value}`);
  const text = String(value);
  if (!/e/i.test(text)) return text;
  // 指数表記（1e-7 など）は、ここで扱う値の範囲では出ない想定だが、念のため展開する
  return value.toFixed(SCALE_DIGITS).replace(/\.?0+$/, '');
}
